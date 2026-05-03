import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { CreateGlobalConfigurationDto } from './dto/create-global-configuration.dto';
import { UpdateGlobalConfigurationDto } from './dto/update-global-configuration.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AppCacheService } from '../common/cache/cache.service';
import { GlobalConfiguration as GlobalConfigurationModel } from '@prisma/client';
import { DataSourceConfiguration as DataSourceConfigurationModel } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { GlobalConfigResponseDto } from './dto/response/global-config-response.dto';
import { ActionResponseDto } from '../common/dto/action-response.dto';

export type GlobalConfigWithDataSource = GlobalConfigurationModel & {
  dataSourceConfig?: (DataSourceConfigurationModel & {
    topics: any[];
  }) | null;
};

@Injectable()
export class GlobalConfigurationsService {
  private readonly logger = new Logger(GlobalConfigurationsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: AppCacheService,
  ) { }

  private readonly CACHE_KEY_ALL = 'global_configurations_all';

  async create(createGlobalConfigurationDto: CreateGlobalConfigurationDto, txClient?: any) {
    const { dataSourceConfig, ...rest } = createGlobalConfigurationDto;
    const prisma = txClient || this.prisma;

    const { id, ...cleanData } = rest;
    const {
      topics,
      subscribeTopic, publishTopic,
      subscribeTopics, publishTopics,
      namespace, event,
      caContent, certContent, keyContent,
      serverCertificate, clientCertificate, clientKey,
      ...dsData
    } = (dataSourceConfig as any) || {};
    // Industrial systems often evolve over time. These mappings handle legacy 
    // single-topic fields (subscribeTopic/publishTopic) and convert them into
    // the modern array-based topic structure automatically. This keeps the
    // API backward compatible with older frontend versions.
    const finalTopics = topics && topics.length > 0
      ? topics.map(({ id, configId, createdAt, ...t }: any) => t)
      : [];
    if (finalTopics.length === 0) {
      if (subscribeTopic) finalTopics.push({ topic: subscribeTopic, type: 'SUBSCRIBE' });
      if (publishTopic) finalTopics.push({ topic: publishTopic, type: 'PUBLISH' });
      if (subscribeTopics) subscribeTopics.forEach(t => finalTopics.push({ topic: t, type: 'SUBSCRIBE' }));
      if (publishTopics) publishTopics.forEach(t => finalTopics.push({ topic: t, type: 'PUBLISH' }));
    }

    const result = await prisma.globalConfiguration.create({
      data: {
        id: id ? BigInt(id) : undefined,
        ...cleanData,
        dataSourceConfig: dataSourceConfig
          ? {
            create: {
              ...dsData as any,
              topics: finalTopics.length > 0
                ? { create: finalTopics as any }
                : undefined,
            },
          }
          : undefined,
      },
      include: {
        dataSourceConfig: {
          include: { topics: true } as any,
        },
      } as any,
    });

    // Handle Certificates
    if (result.dataSourceConfig) {
      const dsIdStr = result.dataSourceConfig.id.toString();
      this.logger.log(`Processing certificates for DataSourceConfig ID: ${dsIdStr}`);
      const updatedDs = await this.processCertificates(dsIdStr, (dataSourceConfig as any) || {});
      if (updatedDs.caPath || updatedDs.certPath || updatedDs.keyPath) {
        this.logger.log(`Updating paths in DB: CA=${updatedDs.caPath}, Cert=${updatedDs.certPath}, Key=${updatedDs.keyPath}`);
        await prisma.dataSourceConfiguration.update({
          where: { globalConfigId: result.id },
          data: {
            caPath: updatedDs.caPath,
            certPath: updatedDs.certPath,
            keyPath: updatedDs.keyPath,
          } as any,
        });

        // Re-fetch the result to include updated paths in the response
        const refreshedResult = await prisma.globalConfiguration.findUnique({
          where: { id: result.id },
          include: {
            dataSourceConfig: {
              include: { topics: true } as any,
            },
          } as any,
        });

        await this.cacheService.del(this.CACHE_KEY_ALL);
        return plainToInstance(GlobalConfigResponseDto, refreshedResult || result);
      }
    }

    await this.cacheService.del(this.CACHE_KEY_ALL);
    return plainToInstance(GlobalConfigResponseDto, result);
  }

  async findAll(): Promise<GlobalConfigResponseDto[]> {
    const cached = await this.cacheService.get<GlobalConfigurationModel[]>(
      this.CACHE_KEY_ALL,
    );
    if (cached) return plainToInstance(GlobalConfigResponseDto, cached);

    const result = await this.prisma.globalConfiguration.findMany({
      include: {
        dataSourceConfig: {
          include: { topics: true } as any,
        },
      } as any,
      orderBy: { id: 'desc' },
    });

    this.logger.log(`Storing in cache (set) ${this.CACHE_KEY_ALL}`);
    await this.cacheService.set(this.CACHE_KEY_ALL, result);
    return plainToInstance(GlobalConfigResponseDto, result);
  }

  /**
   * Internal use only: Returns raw models including sensitive data like passwords.
   */
  async getInternalAll(): Promise<GlobalConfigWithDataSource[]> {
    return this.prisma.globalConfiguration.findMany({
      include: {
        dataSourceConfig: {
          include: { topics: true } as any,
        },
      } as any,
      orderBy: { id: 'desc' },
    }) as any;
  }

  async findOne(id: number): Promise<GlobalConfigResponseDto | null> {
    const cacheKey = `global_configuration_${id}`;
    const cached =
      await this.cacheService.get<GlobalConfigurationModel>(cacheKey);
    if (cached) return plainToInstance(GlobalConfigResponseDto, cached);

    const result = await this.prisma.globalConfiguration.findUnique({
      where: { id: BigInt(id) },
      include: {
        dataSourceConfig: {
          include: { topics: true } as any,
        },
      } as any,
    });

    if (result) {
      this.logger.log(`Storing in cache (set) ${cacheKey}`);
      await this.cacheService.set(cacheKey, result);
    }
    return plainToInstance(GlobalConfigResponseDto, result);
  }

  async update(
    id: number,
    updateGlobalConfigurationDto: UpdateGlobalConfigurationDto,
  ) {
    const { dataSourceConfig, ...rest } = updateGlobalConfigurationDto;
    const { id: _, ...cleanData } = rest;

    const {
      topics,
      subscribeTopic, publishTopic,
      subscribeTopics, publishTopics,
      namespace, event,
      caContent, certContent, keyContent,
      serverCertificate, clientCertificate, clientKey,
      ...dsData
    } = (dataSourceConfig as any) || {};
    // Convert legacy topics to new structure if topics array is empty
    const finalTopics = topics && topics.length > 0
      ? topics.map(({ id, configId, createdAt, ...t }: any) => t)
      : [];
    if (finalTopics.length === 0) {
      if (subscribeTopic) finalTopics.push({ topic: subscribeTopic, type: 'SUBSCRIBE' });
      if (publishTopic) finalTopics.push({ topic: publishTopic, type: 'PUBLISH' });
      if (subscribeTopics) subscribeTopics.forEach(t => finalTopics.push({ topic: t, type: 'SUBSCRIBE' }));
      if (publishTopics) publishTopics.forEach(t => finalTopics.push({ topic: t, type: 'PUBLISH' }));
    }

    this.logger.debug(`Updating GlobalConfig ${id} with data: ${JSON.stringify(cleanData)}`);
    if (dataSourceConfig) {
      this.logger.debug(`DataSourceConfig update payload: ${JSON.stringify(dsData)}, topics: ${finalTopics.length}`);
    }

    let result;
    try {
      result = await this.prisma.globalConfiguration.update({
        where: { id: BigInt(id) },
        data: {
          ...cleanData,
          dataSourceConfig: dataSourceConfig
            ? {
              upsert: {
                create: {
                  ...dsData as any,
                  topics: finalTopics.length > 0
                    ? { create: finalTopics as any }
                    : undefined,
                },
                update: {
                  ...dsData as any,
                  topics: finalTopics.length > 0
                    ? {
                      deleteMany: {},
                      create: finalTopics as any,
                    }
                    : undefined,
                },
              },
            }
            : undefined,
        },
        include: {
          dataSourceConfig: {
            include: { topics: true } as any,
          },
        } as any,
      });
    } catch (e) {
      this.logger.error(`Prisma Update Failed: ${e.message}`, e.stack);
      throw e;
    }

    // Handle Certificates
    if (result.dataSourceConfig) {
      const dsIdStr = result.dataSourceConfig.id.toString();
      this.logger.log(`Processing certificates for update: DataSourceConfig ID: ${dsIdStr}`);
      const updatedDs = await this.processCertificates(dsIdStr, (dataSourceConfig as any) || {});
      if (updatedDs.caPath || updatedDs.certPath || updatedDs.keyPath) {
        this.logger.log(`Updating paths in DB: CA=${updatedDs.caPath}, Cert=${updatedDs.certPath}, Key=${updatedDs.keyPath}`);
        await this.prisma.dataSourceConfiguration.update({
          where: { globalConfigId: BigInt(id) },
          data: {
            caPath: updatedDs.caPath,
            certPath: updatedDs.certPath,
            keyPath: updatedDs.keyPath,
          } as any,
        });

        // Re-flush individual cache
        await this.cacheService.del(`global_configuration_${id}`);

        // Re-fetch to return updated data
        const refreshedResult = await this.prisma.globalConfiguration.findUnique({
          where: { id: BigInt(id) },
          include: {
            dataSourceConfig: {
              include: { topics: true } as any,
            },
          } as any,
        });

        await this.cacheService.del(this.CACHE_KEY_ALL);
        return plainToInstance(GlobalConfigResponseDto, refreshedResult || result);
      }
    }

    await this.cacheService.del(this.CACHE_KEY_ALL);
    await this.cacheService.del(`global_configuration_${id}`);
    return plainToInstance(GlobalConfigResponseDto, result);
  }

  async remove(id: number) {
    const config = await this.prisma.globalConfiguration.findUnique({
      where: { id: BigInt(id) },
      include: { dataSourceConfig: true } as any,
    });

    const result = await this.prisma.globalConfiguration.delete({
      where: { id: BigInt(id) },
    });

    if (config?.dataSourceConfig) {
      const dsId = (config.dataSourceConfig as any).id.toString();
      const certDir = path.join(process.cwd(), 'shared', 'certs', dsId);
      if (fs.existsSync(certDir)) {
        try {
          // When we delete a configuration, we must clean up the physical 
          // certificate files to prevent the storage from leaking over time.
          fs.rmSync(certDir, { recursive: true, force: true });
          this.logger.log(`Deleted certificate directory for DataSourceConfig ${dsId}`);
        } catch (err) {
          this.logger.warn(`Failed to delete cert directory ${certDir}: ${err.message}`);
        }
      }
    }

    await this.cacheService.del(this.CACHE_KEY_ALL);
    await this.cacheService.del(`global_configuration_${id}`);
    return new ActionResponseDto({
      success: true,
      message: `Deleted global configuration ${id}`,
      id: id.toString(),
      count: 1,
    });
  }

  /**
   * Saves certificate strings (Base64/PEM) from the request onto the local filesystem.
   * We store certificates on disk instead of the DB for better performance 
   * and easier integration with MQTT client libraries.
   */
  async clearCache() {
    this.logger.warn(`Clearing all global configuration caches.`);
    await this.cacheService.del(this.CACHE_KEY_ALL);
  }

  private async processCertificates(configId: string, dsData: any): Promise<any> {
    const {
      caContent, serverCertificate,
      certContent, clientCertificate,
      keyContent, clientKey,
      ...cleanDs
    } = dsData;

    // We support multiple field names for the same certificate content 
    // to maintain compatibility with various frontend integrations.
    const actualCa = serverCertificate || caContent;
    const actualCert = clientCertificate || certContent;
    const actualKey = clientKey || keyContent;

    const relativeDir = path.join('shared', 'certs', configId);
    const absDir = path.join(process.cwd(), relativeDir);

    if (actualCa || actualCert || actualKey) {
      // Ensure the directory exists before writing.
      if (!fs.existsSync(absDir)) {
        fs.mkdirSync(absDir, { recursive: true });
      }

      // Write files asynchronously to keep the event loop moving. tw
      const writePromises: Promise<void>[] = [];
      if (actualCa) {
        const fileName = 'ca.crt';
        writePromises.push(fs.promises.writeFile(path.join(absDir, fileName), actualCa));
        cleanDs.caPath = path.join(relativeDir, fileName).replace(/\\/g, '/');
      }
      if (actualCert) {
        const fileName = 'client.crt';
        writePromises.push(fs.promises.writeFile(path.join(absDir, fileName), actualCert));
        cleanDs.certPath = path.join(relativeDir, fileName).replace(/\\/g, '/');
      }
      if (actualKey) {
        const fileName = 'client.key';
        writePromises.push(fs.promises.writeFile(path.join(absDir, fileName), actualKey));
        cleanDs.keyPath = path.join(relativeDir, fileName).replace(/\\/g, '/');
      }

      await Promise.all(writePromises);
    }
    return cleanDs;
  }
}
