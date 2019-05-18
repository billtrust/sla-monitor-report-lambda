const AWS = require('aws-sdk')
const config = require('./config')
const logger = require('./logger')

class ReportService {
    constructor() {}

    async generateSummaryReport(message) {
        logger.debug(`Generating summary report for ${message.service}`);

        // query cloudwatch for summary

        // form our own json structure

    }

    async generateHistoryReport() {

    }

    async generateServicesList() {

    }

}

function getCloudWatchData() {
    const cloudwatch = new AWS.CloudWatch();
    
    // Metric variables
    const namespace = config.METRIC_NAMESPACE,
          ISOtimestamp = process.env.IS_LOCAL ? new Date().toISOString() : getTime(message.timestamp),
          resolution = config.METRIC_RESOLUTION;
  
    let resultValueSuccess,
        resultValueFailure,
        testSucceeded = message.succeeded;
    try {
      if (testSucceeded === true) {
        resultValueSuccess = 1;
        resultValueFailure = 0;
      } else if (testSucceeded === false) {
        resultValueSuccess = 0;
        resultValueFailure = 1;
      } else {
        const msg = `Unexpected message succeeded value from SQS: ${message.succeeded}`;
        logger.error(msg);
        throw new Error(msg);
      }
    }
    catch (err) {
      const msg = `Error parsing message success value: ${err}`;
      logger.error(msg);
      throw err;
    }
  
    const dimensions = [
      {
        Name: "Region",
        Value: `${config.AWS_REGION}`
      },
      {
        Name: "Service",
        Value: `${message.service}`
      },
    ];
  
    // Metric template
    const sourceMetric = {
      Timestamp: ISOtimestamp,
      StorageResolution: resolution,
      Dimensions: dimensions,
      Unit: "Count",
    };
  
}

module.exports = ReportService
