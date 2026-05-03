import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SYSTEM_EVENTS } from 'src/common/const/events';
import * as fs from 'fs';
import * as path from 'path';
import * as mqtt from 'mqtt';
import {
  GlobalConfigurationsService,
  GlobalConfigWithDataSource,
} from 'src/global-configurations/global-configurations.service';
import { MessageDecoderService } from './message-decoder.service';
import { ReadingVariablesService } from 'src/variables/reading-variables.service';
import { WritingVariablesService } from 'src/variables/writing-variables.service';

export interface DataSourceConfig {
  id: string;
  type: 'MQTT' | 'SOCKET';
  host: string;
  port?: number;
  protocol?: string;
  username?: string;
  password?: string;
  caPath?: string;
  certPath?: string;
  keyPath?: string;
  topics: { topic: string; type: 'SUBSCRIBE' | 'PUBLISH' }[];
  maxReadingVariables?: number;
  maxWritingVariables?: number;
}

@Injectable()
export class DataSourceService implements OnModuleDestroy {
  private readonly logger = new Logger(DataSourceService.name);

  // key = brokerKey (host+port+credentials)
  private mqttClients = new Map<string, mqtt.MqttClient>();

  // key = topic → multiple configs allowed
  private topicConfigMap = new Map<string, DataSourceConfig[]>();

  private dataSources: DataSourceConfig[] = [];
  private publishInterval?: NodeJS.Timeout;

  constructor(
    private readonly globalConfigurationsService: GlobalConfigurationsService,
    private readonly decoder: MessageDecoderService,
    private readonly readingVariablesService: ReadingVariablesService,
    private readonly writingVariablesService: WritingVariablesService,
  ) { }

  // async onModuleInit() {
  //   await this.loadConfigurations();
  // }

  onModuleDestroy() {
    this.disconnectAll();
  }

  disconnectAll() {
    this.logger.warn('[DataSource] Disconnecting all MQTT clients.');
    if (this.publishInterval) {
      clearInterval(this.publishInterval);
      this.publishInterval = undefined;
    }

    this.mqttClients.forEach((client) => {
      if (client.connected) {
        client.end(true);
      }
    });
    this.mqttClients.clear();
    this.dataSources = [];
    this.topicConfigMap.clear();
  }

  async initialize() {
    // return;
    this.logger.log('[System] Connecting data sources...');
    await this.loadConfigurations();
  }
  @OnEvent(SYSTEM_EVENTS.RESET)
  async handleSystemReset() {
    this.logger.warn('[DataSource] System reset received. Disconnecting all sources.');
    this.disconnectAll();
  }

  @OnEvent(SYSTEM_EVENTS.RESTORED)
  async handleSystemRestored() {
    this.logger.log('[DataSource] System restored received. Reloading configurations.');
    await this.loadConfigurations();
  }

  private async loadConfigurations() {
    let configs: GlobalConfigWithDataSource[] = [];
    while (true) {
      try {
        // We pull all configurations. This is the heart of the system—if the DB is down,
        // we can't really do anything, so we wait and retry. In a containerized 
        // setup, this just means the "Ready" check will stay red until the DB is up.
        configs = await this.globalConfigurationsService.getInternalAll();
        break;
      } catch (err) {
        this.logger.error('Failed to load configurations from DB, retrying in 5s...', err.message);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    // Stop old MQTT clients if removed
    const oldBrokerKeys = new Set(this.mqttClients.keys());

    // Prepare new data sources
    const newDataSources: DataSourceConfig[] = [];
    const newTopicMap = new Map<string, DataSourceConfig[]>();

    for (const c of configs) {
      const ds = c.dataSourceConfig! as any;
      const dataSource: DataSourceConfig = {
        id: ds.globalConfigId.toString(),
        type: ds.type as 'MQTT' | 'SOCKET',
        host: ds.host!,
        port: ds.port ?? 8883,
        protocol: ds.protocol || 'mqtts',
        username: ds.username || undefined,
        password: ds.password || undefined,
        caPath: ds.caPath || undefined,
        certPath: ds.certPath || undefined,
        keyPath: ds.keyPath || undefined,
        topics: ds.topics.map((t) => ({
          topic: t.topic,
          type: t.type as 'SUBSCRIBE' | 'PUBLISH',
        })),
        maxReadingVariables: c.maxReadingVariables ?? 0,
        maxWritingVariables: c.maxWritingVariables ?? 0,
      };
      newDataSources.push(dataSource);

      for (const t of dataSource.topics) {
        if (t.type === 'SUBSCRIBE') {
          if (!newTopicMap.has(t.topic)) {
            newTopicMap.set(t.topic, []);
          }
          newTopicMap.get(t.topic)!.push(dataSource);
        }
      }
    }


    // Replace old configs atomically
    this.dataSources = newDataSources;
    this.topicConfigMap = newTopicMap;

    // Connect new brokers if needed
    this.connectAllMqttSources();

    // Stop old brokers that no longer exist
    for (const brokerKey of oldBrokerKeys) {
      const brokerBase = brokerKey.split('_')[0]; // type:host:port
      const stillNeeded = newDataSources.some((ds) => {
        let protocol = ds.protocol;
        if (!protocol && ds.port === 8883) protocol = 'mqtts';
        if (!protocol) protocol = 'mqtt';

        return `${protocol}://${ds.host}:${ds.port ?? 1883}` === brokerBase;
      });

      if (!stillNeeded) {
        const client = this.mqttClients.get(brokerKey);
        client?.end(true);
        this.mqttClients.delete(brokerKey);
        this.logger.log(`Stopped broker client: ${brokerKey}`);
      }
    }
  }

  private connectAllMqttSources() {
    const brokerGroups = new Map<string, DataSourceConfig[]>();

    for (const config of this.dataSources) {
      if (config.type !== 'MQTT') continue;

      let protocol = config.protocol;
      if (!protocol && config.port === 8883) protocol = 'mqtts';
      if (!protocol) protocol = 'mqtt';

      const brokerUrl = `${protocol}://${config.host}:${config.port ?? 1883}`;
      const brokerKey = `${brokerUrl}_${config.username ?? ''}_${config.password ?? ''}_${config.caPath ?? ''}_${config.certPath ?? ''}_${config.keyPath ?? ''}`;

      if (!brokerGroups.has(brokerKey)) {
        brokerGroups.set(brokerKey, []);
      }

      brokerGroups.get(brokerKey)!.push(config);
    }

    for (const [brokerKey, configs] of brokerGroups.entries()) {
      this.connectBroker(brokerKey, configs);
    }
  }

  private connectBroker(brokerKey: string, configs: DataSourceConfig[]) {
    const firstConfig = configs[0];
    this.logger.debug(`MQTT First Config: ${JSON.stringify(firstConfig)}`);

    // Support mqtts and other protocols
    let protocol = firstConfig.protocol;
    if (!protocol && firstConfig.port === 8883) protocol = 'mqtts';
    if (!protocol) protocol = 'mqtt';

    const brokerUrl = `${protocol}://${firstConfig.host}:${firstConfig.port ?? 1883}`;
    this.logger.log(`Connecting:
  protocol=${protocol}
  host=${firstConfig.host}
  port=${firstConfig.port}
`);
    const options: any = {
      username: firstConfig.username,
      password: firstConfig.password,
      reconnectPeriod: 5000,
      connectTimeout: 10000,

      // ✅ ADD THESE
      clientId: `client_${Math.random().toString(16).slice(2, 10)}`,
      keepalive: 60,
      clean: true,
    };

    // 🔒 TLS/SSL SECURITY:
    // If we're using MQTTS, the broker likely expects encrypted communication.
    // In industrial settings, this often means Mutual TLS (mTLS), where BOTH
    // the server and the client must present certificates. 
    // If you see "alert certificate required", it means the broker is asking 
    // for a client certificate that we haven't provided or is invalid.
    if (protocol === 'mqtts') {
      try {
        if (firstConfig.caPath) {
          const caAbs = path.isAbsolute(firstConfig.caPath) ? firstConfig.caPath : path.resolve(process.cwd(), firstConfig.caPath);
          options.ca = fs.readFileSync(caAbs);
        }
        if (firstConfig.certPath) {
          const certAbs = path.isAbsolute(firstConfig.certPath) ? firstConfig.certPath : path.resolve(process.cwd(), firstConfig.certPath);
          options.cert = fs.readFileSync(certAbs);
        }
        if (firstConfig.keyPath) {
          const keyAbs = path.isAbsolute(firstConfig.keyPath) ? firstConfig.keyPath : path.resolve(process.cwd(), firstConfig.keyPath);
          options.key = fs.readFileSync(keyAbs);
        }
        // Self-signed certificates are extremely common in local factory networks.
        // We set rejectUnauthorized to false to allow these connections by default,
        // while still maintaining encrypted transport.
        options.rejectUnauthorized = false;
        this.logger.debug(`Security options loaded for ${brokerUrl}`);
      } catch (err) {
        this.logger.error(`Failed to read certificate files from disk for ${brokerUrl}: ${err.message}. Ensure files exist in shared/certs/`);
      }
    }

    this.logger.debug(`Connecting to broker: ${brokerUrl}`);

    // Safety check: if we already have a client that's healthy, don't kill it.
    // Reconnecting causes message loss, so we prefer reusing the session.
    const existingClient = this.mqttClients.get(brokerKey);
    if (existingClient && (existingClient.connected || existingClient.reconnecting)) {
      this.logger.log(`Reusing existing connection for ${brokerUrl}`);
      // Even if the connection is old, the topic mappings might have changed.
      // We re-subscribe to everything to be sure.
      for (const config of configs) {
        for (const t of config.topics) {
          if (t.type === 'SUBSCRIBE') {
            existingClient.subscribe(t.topic);
          }
        }
      }

      return;
    }

    const client = mqtt.connect(brokerUrl, options);

    client.on('connect', () => {
      this.logger.log(`Connected to ${brokerUrl}`);

      for (const config of configs) {
        const subscribeTopics = config.topics.filter(t => t.type === 'SUBSCRIBE').map(t => t.topic);
        const publishTopics = config.topics.filter(t => t.type === 'PUBLISH').map(t => t.topic);

        if (subscribeTopics.length > 0) {
          this.logger.log(`[${brokerUrl}] Subscribing to: ${subscribeTopics.join(', ')}`);
        }
        if (publishTopics.length > 0) {
          this.logger.log(`[${brokerUrl}] Registered for publishing: ${publishTopics.join(', ')}`);
        }

        for (const t of config.topics) {
          if (t.type !== 'SUBSCRIBE') continue;

          client.subscribe(t.topic, (err) => {
            if (err) {
              this.logger.error(
                `[MQTT:${brokerUrl}] Subscribe failed → ${t.topic} | ${err.message}`,
              );
            } else {
              this.logger.log(
                `[MQTT:${brokerUrl}] Subscribed → ${t.topic}`,
              );
            }
          });
        }
      }
      // this.startAutoPublish(configs);
    });

    client.on('message', (topic: string, message: Buffer) => {
      try {
        this.routeMessage(topic, message);
      } catch (err: unknown) {
        const error = err as Error;
        this.logger.error(
          `Message handling error (${brokerUrl}) ${error.message}`,
        );
      }
    });

    client.on('reconnect', () => {
      this.logger.warn(`Reconnecting to ${brokerUrl}`);
    });

    client.on('close', () => {
      this.logger.warn(`Connection closed ${brokerUrl}`);
    });

    client.on('offline', () => {
      this.logger.warn(`Broker offline ${brokerUrl}`);
    });

    client.on('error', (err) => {
      this.logger.error(`MQTT Error ${brokerUrl}: ${err.message} : ${err.stack}`);
      this.logger.error(`MQTT Error ${brokerUrl}: ${err.message}`);
    });

    this.mqttClients.set(brokerKey, client);
  }

  private routeMessage(topic: string, message: Buffer) {
    const configs = this.topicConfigMap.get(topic);

    if (!configs || configs.length === 0) return;

    // Note: If multiple configurations share a topic, we only let the first one
    // handle it to prevent duplicate DB writes. This is a "first-win" strategy.
    const config = configs[0];
    this.handleMessage(config, topic, message);
  }

  private async handleMessage(
    config: DataSourceConfig,
    topic: string,
    message: Buffer,
  ) {
    try {
      this.logger.log(
        `[MQTT:${config.id}] ⚙️ Processing → topic=${topic}`
      );
      const decoded = this.decoder.decode(
        config.id,
        topic,
        message,
        config.maxReadingVariables,
      );

      this.logger.log(
        `[MQTT:${config.id}] ${topic} → count=${decoded.values.length}`,
      );
      this.logger.log(
        `[MQTT:${config.id}] Values: ${JSON.stringify(decoded.values)}`,
      );

      // Await and log DB response
      const dbResult =
        await this.readingVariablesService.updateReadingVariablesByIndex(
          Number(config.id),
          decoded.values,
        );
      const writeData =
        await this.writingVariablesService.findAllEncodedWritingVariables(
          Number(config.id),
        );
      const combinedRawValue = (writeData || [])
        .map((item) => item.rawValue || '')
        .join('');

      // this.logger.log(
      //     `[MQTT:${config.id}] DB Updated → updatedCount=${JSON.stringify(dbResult)}`
      // );

      const publishTopic = config.topics.find(t => t.type === 'PUBLISH');

      if (publishTopic && publishTopic.topic !== topic) {
        this.publish(config.id, publishTopic.topic, [combinedRawValue]);
      }

    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(
        `HandleMessage error (config ${config.id}):`,
        error.stack || error.message || String(error),
      );

      // If we can't process a message (e.g. malformed payload), we log the start
      // of it so developers can see what the broker is actually sending.
      this.logger.debug(
        `Failed message: ${message.toString().substring(0, 200)}`,
      );

      // CRITICAL FALLBACK: If the DB is down or decoding fails, we CANNOT lose the data.
      // We dump it into a local NDJSON file (Dead Letter Queue). 
      // This is a life-saver for industrial telemetry.
      try {
        const dlqEntry = JSON.stringify({
          timestamp: new Date().toISOString(),
          broker: config.host,
          topic,
          payload: message.toString('base64'),
          error: error.message
        });

        fs.appendFile('telemetry-dlq.ndjson', dlqEntry + '\n', (fsErr) => {
          if (fsErr) {
            this.logger.error(`FATAL: Dead Letter Queue write failed!`, fsErr);
          } else {
            this.logger.error(`[DLQ] Saved failed telemetry payload securely to telemetry-dlq.ndjson`);
          }
        });
      } catch (dlqErr) {
        this.logger.error(`Error preparing DLQ entry:`, dlqErr);
      }
    }
  }

  publish(dataSourceId: string, topic: string, values: any[]) {
    const config = this.dataSources.find((ds) => ds.id === dataSourceId);
    if (!config) return;

    let protocol = config.protocol;
    if (!protocol && config.port === 8883) protocol = 'mqtts';
    if (!protocol) protocol = 'mqtt';

    const brokerUrl = `${protocol}://${config.host}:${config.port ?? 1883}`;
    const brokerKey = `${brokerUrl}_${config.username ?? ''}_${config.password ?? ''}_${config.caPath ?? ''}_${config.certPath ?? ''}_${config.keyPath ?? ''}`;

    const client = this.mqttClients.get(brokerKey);

    if (!client || !client.connected) {
      this.logger.warn(
        `[MQTT:${dataSourceId}] Cannot publish. Client not connected.`,
      );
      return;
    }

    let finalValues = values;

    if (config.maxWritingVariables && config.maxWritingVariables > 0) {
      finalValues = values.slice(0, config.maxWritingVariables);
    }

    const payload = JSON.stringify(finalValues);

    this.logger.log(
      `[MQTT:${dataSourceId}] 🚀 Publishing → topic=${topic} | payload=${payload}`
    );

    client.publish(topic, payload, (err) => {
      if (err) {
        this.logger.error(
          `[MQTT:${dataSourceId}] ❌ Publish failed → ${topic} | ${err.message}`
        );
      } else {
        this.logger.log(
          `[MQTT:${dataSourceId}] 📤 Published → topic=${topic}`
        );
      }
    });
  }
  private startAutoPublish(configs: DataSourceConfig[]) {
    if (this.publishInterval) return;

    this.logger.log("⏱ Starting auto-publish every 5 seconds...");

    this.publishInterval = setInterval(() => {
      this.logger.log("⏱ Publishing every 5 seconds...");

      for (const config of configs) {
        const publishTopic = config.topics.find(t => t.type === 'PUBLISH');

        if (publishTopic) {
          this.publish(config.id, publishTopic.topic, ["test-data"]);
        }
      }

    }, 5000);
  }
}
