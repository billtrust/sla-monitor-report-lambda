const AWS = require('aws-sdk');
const logger = require('./logger');
const Moment = require('moment');
const MomentRange = require('moment-range');
const moment = MomentRange.extendMoment(Moment);


async function uploadFile(s3bucket, s3key, body) {
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

// returns null if key not found
async function fileModifiedSecondsAgo(s3bucket, s3key) {
    let lastModified = await fileLastModified(s3bucket, s3key);
    if (!lastModified) {
        return null;
    }
    let currentTime = new Date();
    let duration = moment.duration(moment(currentTime).diff(moment(lastModified)));
    return duration.asSeconds();
}

// returns null if key not found
async function fileLastModified(s3bucket, s3key) {
    try {
        const s3 = new AWS.S3();
        let params = {
            Bucket: s3bucket,
            Key: s3key
        };
        const response = await s3.headObject(params).promise();
        return response.LastModified;
    } catch (headErr) {
        if (headErr.code === 'NotFound') {
            logger.debug(`Not found: s3://${s3bucket}/${s3key}`);
            return null;
        } else {
            logger.debug(`Unexpected error on headObject for s3://${s3bucket}/${s3key}: ${headErr}`);
        }
    }
}


module.exports = {
    uploadFile,
    fileModifiedSecondsAgo,
    fileLastModified
};
