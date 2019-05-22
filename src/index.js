'use strict';

const AWS = require('aws-sdk');
const config = require('./config');
const logger = require('./logger');
const ReportService = require('./reportService');
const S3Util = require('./s3util');

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
    let report = await reportService.generateReport(
        message,
        ['1d', '3d', '7d', '14d']
    );
    //logger.debug(report);

    // add generated on properties to the reports
    let currentEpoch = Math.round((new Date()).getTime() / 1000);
    report.summary['reportGeneratedOn'] = currentEpoch;
    report.history['reportGeneratedOn'] = currentEpoch;

    await S3Util.uploadToS3(
        config.REPORTS_S3_BUCKET_NAME,
        `${process.env.AWS_ENV || 'dev'}/${message.service}/summary.json`,
        JSON.stringify(report.summary, null, 2)
        );

    await S3Util.uploadToS3(
        config.REPORTS_S3_BUCKET_NAME,
        `${process.env.AWS_ENV || 'dev'}/${message.service}/history.json`,
        JSON.stringify(report.history, null, 2)
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
  