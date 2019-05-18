'use strict';

const AWS = require('aws-sdk');
const config = require('./config');
const logger = require('./logger');
const ReportService = require('./reportService');

async function handler(event, context, done) {
    // raw console log output easier to copy/paste json from cloudwatch logs
    if (process.env.LOG_LEVEL == 'trace') {
        console.log('Event: ', JSON.stringify(event));
    }
    
    try {
        let promises = [];
        for (let record of event.Records) {
        let snsRecordBody = JSON.parse(record.body);
            promises.push(processMessage(JSON.parse(snsRecordBody.Message), record.receiptHandle));
        }
        await Promise.all(promises);
        logger.debug("All processed");
        done();
    }
    catch (err) {
        done(err);
    }
}

async function deleteMessage(receiptHandle) {
    const sqs = new AWS.SQS({region: config.AWS_REGION});
    const awsAccountId = await getAwsAccountId();
    const queueUrl = `https://sqs.${config.AWS_REGION}.amazonaws.com/${awsAccountId}/${config.RESULTS_SQS_QUEUE_NAME}`;
    logger.debug(`Deleting message with receiptHandle ${receiptHandle} for queueUrl: ${queueUrl}`);

    const testingHandles = ['MessageReceiptHandle', 'SuccessTestingHandle', 'FailureTestingHandle'];

    if (testingHandles.includes(receiptHandle)) {
        logger.debug('Skipping delete message, receipt handle indicates local testing');
    } else {
        try {
        await sqs.deleteMessage({
            ReceiptHandle: receiptHandle,
            QueueUrl: queueUrl
            }).promise();
        }
        catch (err) {
            logger.error(`Error deleting message with receiptHandle ${receiptHandle}:`, err);
            throw err;
        }
    }
    }

async function getAwsAccountId() {
    const sts = new AWS.STS();
    const params = {};
    let data = await sts.getCallerIdentity(params).promise();
    return data.Account;
}

async function processMessage(message, receiptHandle) {
    // sample message:
    // {
    //     timestamp: 1558115155,
    //     succeeded: true,
    //     groups: [ 'all', 'devteamname' ],
    //     service: 'myservice',
    //     testExecutionSecs: 14.6719
    // }

    const reportService = new ReportService();
    await reportService.generateSummaryReport(
        message
    );

    await deleteMessage(receiptHandle)
}
  
function getTime(timestamp){
    let a = new Date(timestamp * 1000);
    const isoString = a.toISOString();
    logger.debug(`Timestamp: ${isoString}`);
    return isoString;
}

module.exports.handler = handler;
  