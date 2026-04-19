import { MetricsReporter } from '../utils/metricsReporter';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const influxUrl    = process.env.INFLUXDB_URL    ?? 'http://localhost:8086';
const influxToken  = process.env.INFLUXDB_TOKEN  ?? 'mytoken';
const influxOrg    = process.env.INFLUXDB_ORG    ?? 'playwright';
const influxBucket = process.env.INFLUXDB_BUCKET ?? 'testresults';

async function main(): Promise<void> {
  console.log('\n  ◈ JARVIS Metrics Reporter\n');
  console.log(`  InfluxDB: ${influxUrl} → ${influxOrg}/${influxBucket}`);
  console.log('  Parsing: test-results/results.json\n');

  const reporter = new MetricsReporter(influxUrl, influxToken, influxOrg, influxBucket);

  await reporter.pushMetrics();
  console.log('\n  ✔  Metrics pushed successfully.\n');
}

main().catch(err => {
  console.error('\n  ✘  Metrics push failed:', err.message);
  process.exit(1);
});
