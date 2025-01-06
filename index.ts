import fs from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { CliArguments, LoyaltyTransactionAudit, PointAllocation, UserWallet } from './types';
import { formatExecutionTime, newPointAllocation, newWallet } from './utils/helpers';
import { DataProcessor } from './processors/dataProcessor';

async function main(): Promise<void> {
  const argv = (await yargs(hideBin(process.argv))
    .options({
      input: {
        type: 'string',
        demandOption: true,
        describe: 'Input CSV file path',
      },
      authorization: {
        type: 'string',
        demandOption: true,
        describe: 'Authorization token',
      },
      capillaryHost: {
        type: 'string',
        demandOption: true,
        describe: 'Capillary host',
      },
      concurrency: {
        type: 'number',
        default: 5,
        describe: 'Number of concurrent requests',
      },
      batchSize: {
        type: 'number',
        default: 500,
        describe: 'Number of items per batch',
      },
      batchConcurrentLimit: {
        type: 'number',
        default: 100,
        describe: 'Number of items to process in parallel',
      },
      retryAttempts: {
        type: 'number',
        default: 3,
        describe: 'Number of retry attempts',
      },
      retryDelay: {
        type: 'number',
        default: 1000,
        describe: 'Delay between retry attempts',
      },
    })
    .help().argv) as CliArguments;
  const { input, authorization, ...config } = argv;

  // check input is csv file
  if (!input.endsWith('.csv')) {
    console.error('Invalid input file. Please provide a CSV file');
    return;
  }
  const processor = new DataProcessor({
    ...config,
    authorization,
  });

  try {
    const startTime = Date.now();
    console.log('Started processing...');

    const result = await processor.processCSVFile(input);
    const { successful, failed } = result;
    const timeUnix = new Date().getTime();
    const destinationFolder = `${process.cwd()}/output/${timeUnix}`;

    if (!fs.existsSync(destinationFolder)) {
      fs.mkdirSync(destinationFolder, { recursive: true });
    }
    const walletJson: UserWallet[] = [],
      pointAllocations: Omit<PointAllocation, 'audit'>[] = [],
      transactionAudit: LoyaltyTransactionAudit[] = [];

    successful.forEach((user) => {
      walletJson.push(newWallet(user));
      user.point_allocations.forEach((p: PointAllocation) => {
        pointAllocations.push(newPointAllocation(p));
        transactionAudit.push(p.audit);
      });
    });
    // Save results to files
    if (failed.length) fs.writeFileSync(`${destinationFolder}/failed_users_logs.json`, JSON.stringify(failed, null, 2));

    if (successful.length) {
      fs.writeFileSync(`${destinationFolder}/successful_users_logs.json`, JSON.stringify(successful, null, 2));
      fs.writeFileSync(`${destinationFolder}/wallets.json`, JSON.stringify(walletJson, null, 2));
    }

    if (pointAllocations.length) {
      fs.writeFileSync(`${destinationFolder}/point_allocations.json`, JSON.stringify(pointAllocations, null, 2));
      fs.writeFileSync(`${destinationFolder}/transaction_audits.json`, JSON.stringify(transactionAudit, null, 2));
    }

    const endTime = Date.now();
    console.log(`
            Processing completed:
            - Total processed: ${result.totalProcessed}
            - Successful: ${result.successful.length}
            - Failed: ${result.failed.length}
            - Started at: ${new Date(startTime).toISOString()}
            - Ended at: ${new Date(endTime).toISOString()}
            - Total execution time: ${formatExecutionTime(startTime, endTime)}
        `);
  } catch (error) {
    console.error('Error in main process:', error instanceof Error ? error.message : error);
    throw error;
  }
}

// Execute
main().catch(console.error);
