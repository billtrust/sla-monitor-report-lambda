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
    const queueUrl = `https://sqs.${config.AWS_REGION}.amazonaws.com/${awsAccountId}/${config.REPORTS_SQS_QUEUE_NAME}`;
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
    logger.trace(report);

    // add generated on properties to the reports
    let currentEpoch = Math.round((new Date()).getTime() / 1000);
    report.summary['reportGeneratedOn'] = currentEpoch;
    report.history['reportGeneratedOn'] = currentEpoch;

    await S3Util.uploadFile(
        config.REPORTS_S3_BUCKET_NAME,
        `${process.env.AWS_ENV || 'dev'}/${message.service}/summary.json`,
        JSON.stringify(report.summary, null, 2)
        );

    for (let rangeHistory of report.history) {
        await S3Util.uploadFile(
            config.REPORTS_S3_BUCKET_NAME,
            `${process.env.AWS_ENV || 'dev'}/${message.service}/history/${rangeHistory.timeRange}.json`,
            JSON.stringify(rangeHistory.history, null, 2)
            );
    
    }

    // rather than query cloudwatch each time for the list of services, we only
    // need to do this periodically, so find the last time this file was written
    // to s3 and only query cloudwatch and write the file if it is old
    let refreshServicesList = false;
    let servicesListS3Key = `${process.env.AWS_ENV || 'dev'}/services.json`;
    let modifiedSecondsAgo = await S3Util.fileModifiedSecondsAgo(config.REPORTS_S3_BUCKET_NAME, servicesListS3Key);
    if (!modifiedSecondsAgo) {
        logger.info('Services list does not yet exist');
        refreshServicesList = true;
    } else {
        logger.info(`Services list modified ${modifiedSecondsAgo} seconds ago`);
        if (modifiedSecondsAgo > config.SERVICES_LIST_TTL_SECONDS) {
            refreshServicesList = true;
        }
    }

    if (!refreshServicesList) {
        logger.info('Skipping refresh of services list');
    } else {
        let services = await reportService.generateServicesList();
        let servicesList = [];
        for (let service of services) {
            servicesList.push({ service });
        }
        await S3Util.uploadFile(
            config.REPORTS_S3_BUCKET_NAME,
            servicesListS3Key,
            JSON.stringify(servicesList, null, 2)
            );
    }
    
    await deleteMessage(receiptHandle)
}
  
function getTime(timestamp){
    let a = new Date(timestamp * 1000);
    const isoString = a.toISOString();
    logger.debug(`Timestamp: ${isoString}`);
    return isoString;
}

module.exports.handler = handler;
  