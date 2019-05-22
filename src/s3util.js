const AWS = require('aws-sdk');
const logger = require('./logger');

async function uploadToS3(s3bucket, s3key, body) {
    logger.debug(`Writing ${body.length} chars to s3://${s3bucket}/${s3key}`);
    try {
        const s3 = new AWS.S3();
        let resp = await s3.putObject({
            Bucket: s3bucket,
            Key: s3key,
            Body: body,
            ContentType: 'application/json'
        }).promise();

        logger.trace(`S3 PutObject response for s3://${s3bucket}/${s3key}:`, resp);
    }
    catch (err) {
        logger.error(`Error writing to s3://${s3bucket}/${s3key}:`, err);
        throw err;
    }
    logger.info(`Successfully wrote ${body.length} chars to s3://${s3bucket}/${s3key}`);
}

module.exports = {
    uploadToS3
};
