const AWS = require('aws-sdk');
const config = require('./config');
const logger = require('./logger');
const Moment = require('moment');
const MomentRange = require('moment-range');
const moment = MomentRange.extendMoment(Moment);
const jsonQuery = require('json-query')


class ReportService {
    constructor() {}

    async generateReport(message, timeRanges) {
        logger.debug(`Generating summary report for ${message.service}`);

        const endTime = (new Date).getTime();
        const longestTimeRange = timeRanges[timeRanges.length - 1]
        const startTime = epochFromStartOfTimeRange(longestTimeRange)
        // add current SNS data point to metricResults since that was just written to cloudwatch
        // and won't likely appear in the results
        let metricResults = [
            {
                timestamp: message.timestamp,
                succeeded: message.succeeded,
                testExecutionSecs: message.testExecutionSecs
            },
            ... await getCloudWatchSLAMetrics(startTime, endTime, message.service)
        ]
        logger.trace(metricResults);

        let rangeSummaries = [];
        for (let timeRangeStr of timeRanges) {
            let rangeSummary = calculateRangeSummary(metricResults, timeRangeStr);
            rangeSummaries.push(
                {
                    timeRange: timeRangeStr,
                    summary: {
                        numAttempts: rangeSummary.numAttempts,
                        numSuccesses: rangeSummary.numSuccesses,
                        successPercent: rangeSummary.successPercent,
                        failureMinutes: Math.round(rangeSummary.failureMinutes * 100) / 100,
                        numFailures: rangeSummary.numFailures,
                        numOutages: rangeSummary.numOutages
                    }
                }
            )
        }

        let statusChanges = calculateStatusChanges(metricResults, message.service);

        let rangeHistory = {};
        for (let timeRangeStr of timeRanges) {
            rangeHistory[timeRangeStr] = { history: [] };
        }
        for (let timeRangeStr of timeRanges) {
            for (let metric of metricResults) {
                if (isTimestampWithinTimeRange(metric.timestamp, timeRangeStr)) {
                    rangeHistory[timeRangeStr]['history'].push(metric);
                }
            }
        }

        let rangeHistoryArr = [];
        for (let timeRangeStr of timeRanges) {
            rangeHistoryArr.push(
                {
                    timeRange: timeRangeStr,
                    history: rangeHistory[timeRangeStr]
                });
        }

        return {
            summary: {
                serviceName: message.service,
                env: process.env.AWS_ENV,
                currentStatus: message.succeeded ? 'SUCCESS' : 'FAILURE',
                rangeSummaries: [
                    ... rangeSummaries
                ],
                statusChanges    
            },
            history: [
                ... rangeHistoryArr
            ]
        };

    }

    async generateServicesList(nextToken) {
        const cloudwatch = new AWS.CloudWatch();
        var params = {
            Namespace: config.METRIC_NAMESPACE,
        };
        if (nextToken) {
            params['NextToken'] = nextToken;
        }
        let serviceNames = [];
        try {
            let data = await cloudwatch.listMetrics(params).promise()
            logger.trace(data);
            for (let metric of data.Metrics) {
                let serviceName = jsonQuery('Dimensions[Name=Service].Value', { data: metric }).value;
                if (serviceName && !serviceNames.includes(serviceName) ) {
                    serviceNames.push(serviceName);
                }
            }
            if (data.NextToken) {
                serviceNames.push(
                    ... await this.generateServicesList(data.NextToken)
                );
            }
        }
        catch (err) {
            logger.error(`Error listing CloudWatch metrics: ${err}`);
            throw err;
        }
        return serviceNames;
    }

}

async function getCloudWatchSLAMetrics(startTime, endTime, serviceName, nextToken) {
    logger.debug(`Retrieving CloudWatch metrics for ${serviceName} for period ${moment(startTime).format()} to ${moment(endTime).format()}`);
    if (nextToken) {
        logger.debug(`Processing for subsequent token ${nextToken.substring(0,10)}...`)
    }
    
    const cloudwatch = new AWS.CloudWatch();

    let params = {
        StartTime: moment(startTime).toISOString(),
        EndTime: moment(endTime).toISOString(),
        ScanBy: 'TimestampDescending',
        MaxDatapoints: 100000,
        MetricDataQueries: [
            {
                Id: 'successes',
                MetricStat: {
                    Metric: {
                      Dimensions: [
                        {
                            Name: 'Region',
                            Value: `${config.AWS_REGION}`
                          },
                          {
                            Name: 'Service',
                            Value: serviceName
                          }
                      ],
                      MetricName: 'integration-sla-success',
                      Namespace: config.METRIC_NAMESPACE
                    },
                    Period: 60, // seconds
                    Stat: 'Maximum',
                    Unit: 'Count'
                  },
                  ReturnData: true
            },
            {
                Id: 'attempts',
                MetricStat: {
                    Metric: {
                      Dimensions: [
                        {
                            Name: 'Region',
                            Value: `${config.AWS_REGION}`
                          },
                          {
                            Name: 'Service',
                            Value: serviceName
                          }
                      ],
                      MetricName: 'integration-sla-attempts',
                      Namespace: config.METRIC_NAMESPACE
                    },
                    Period: 60, // seconds
                    Stat: 'Maximum',
                    Unit: 'Count'
                  },
                  ReturnData: true
            },
            {
                Id: 'duration',
                MetricStat: {
                    Metric: {
                      Dimensions: [
                        {
                            Name: 'Region',
                            Value: `${config.AWS_REGION}`
                          },
                          {
                            Name: 'Service',
                            Value: serviceName
                          }
                      ],
                      MetricName: 'sla-test-duration-secs',
                      Namespace: config.METRIC_NAMESPACE
                    },
                    Period: 60, // seconds
                    Stat: 'Maximum',
                    Unit: 'Count'
                  },
                  ReturnData: true
            }

        ]
    }
    if (nextToken) {
        params['NextToken'] = nextToken;
    }

    let results = [];
    
    let cwData = null;
    try
    {
        cwData = await cloudwatch.getMetricData(params).promise();
        // logger.trace('CloudWatch raw getMetricData:');
        // logger.trace(cwData);
        for (let i=0; i<cwData.MetricDataResults[0].Timestamps.length; i++) {
            results.push({
                timestamp: convertUtcStringToEpoch(cwData.MetricDataResults[0].Timestamps[i]),
                succeeded: cwData.MetricDataResults[0].Values[i],
                testExecutionSecs: cwData.MetricDataResults[2].Values[i]
            });
        }
        if (cwData.NextToken) {
            results.push(
                ... await getCloudWatchSLAMetrics(startTime, endTime, serviceName, cwData.NextToken)
            )
        }
    }
    catch (err) {
        logger.error('Error reading from CloudWatch: ' + err);
        throw err;
    }

    return results;
}

// metricResults format: (return value of getCloudwatchSLAMetrics), example:
// { timestamp: 2019-05-21T00:31:00.000Z,
//     succeeded: 1,
//     testExecutionSecs: 18.8641 }
// timeRangeStr: string enum in format 1d, 3d, 7d, 14d, etc.
function calculateRangeSummary(metricResults, timeRangeStr) {
    logger.debug(`Calculating range summary for ${timeRangeStr}, metricResults length: ${metricResults.length}`)
    let numAttempts = 0,
        numSuccesses = 0,
        numFailures = 0,
        failureMinutes = 0,
        numOutages = 0;

    // if the first data point is a failure, we need to start out with an outage
    if (!metricResults[0].succeeded) {
        numOutages = 1;
    }

    let lastStatusWasSuccess = true,
        lastTimestamp = null;
    for (let result of metricResults) {
        let prev = lastStatusWasSuccess;

        if (isTimestampWithinTimeRange(result.timestamp, timeRangeStr)) {
            numAttempts++;
            if (result.succeeded) {
                lastStatusWasSuccess = true;
                numSuccesses++;
            } else {
                lastStatusWasSuccess = false;
                numFailures++;
                if (lastTimestamp) {
                    failureMinutes += numMinutesBetweenTimestamps(result.timestamp, lastTimestamp);
                }
                lastTimestamp = result.timestamp;
            }
            // did the status change from the prior period?
            if (lastStatusWasSuccess != prev) {
                // each time the status changes to a failure, increment num outages
                if (result.succeeded == 0) {
                    numOutages++;
                }
            }
        }
    }

    return {
        numAttempts,
        numSuccesses,
        successPercent: numSuccesses == 0 ? 0 : Math.floor(numSuccesses / numAttempts*100),
        numFailures,
        failureMinutes,
        numOutages
    }
}

function calculateStatusChanges(metricResults, service) {
    logger.debug(`Calculating status changes (metricResults length: ${metricResults.length})`)

    let statusChanges = [],
        lastStatusWasSuccess = true,
        lastTimestamp = metricResults[0].timestamp,
        durationMins = 0,
        timeStampLastChange = metricResults[0].timestamp;
    let allMetricsExceptFirst = metricResults.slice(1);
    for (let result of allMetricsExceptFirst) {
        let prev = lastStatusWasSuccess;

        if (result.succeeded) {
            lastStatusWasSuccess = true;
        } else {
            lastStatusWasSuccess = false;
            if (lastTimestamp) {
                durationMins += numMinutesBetweenTimestamps(result.timestamp, lastTimestamp);
            }
            lastTimestamp = result.timestamp;
        }
        // did the status change from the prior period?
        if (lastStatusWasSuccess != prev) {
            statusChanges.push({
                status: result.succeeded ? 'SUCCESS' : 'FAILURE', // TODO: 'UNKNOWN' ???
                fromTimestamp: convertUtcStringToEpoch(timeStampLastChange),
                toTimestamp: convertUtcStringToEpoch(result.timestamp),
                durationMins,
                detailLocation: `s3://${config.SLARUNNER_S3BUCKETNAME}/${service}/${(new Date(result.timestamp)).getTime()}_${result.succeeded ? 'SUCCESS' : 'FAILURE'}`
            });
            timeStampLastChange = result.timestamp;
            durationMins = 0;
        }
    }

    return statusChanges;
}


// given a time range string like '7d' (for 7 days), returns the epoch time of the
// beginning of that period, meaning '7d' would be 7 days ago from the current time
function epochFromStartOfTimeRange(timeRangeStr) {
    const days = Number(timeRangeStr.replace('d', '')); // '1d' - > 1
    let d = new Date();
    d.setDate(d.getDate()-days);
    return d.getTime();
}

function numMinutesBetweenTimestamps(startTime, endTime) {
    let duration = moment.duration(moment(endTime).diff(moment(startTime)));
    return duration.asMinutes();
}

function convertTimeRangeStrToRange(timeRangeStr) {
    let startDate = epochFromStartOfTimeRange(timeRangeStr),
        endDate = (new Date).getTime();
    return moment().range(startDate, endDate);
}

function isTimestampWithinTimeRange(epochTimestamp, timeRangeStr) {
    let range = convertTimeRangeStrToRange(timeRangeStr);
    let utcTimestamp = new Date(epochTimestamp * 1000);
    let isWithinRange = range.contains(utcTimestamp);
    //logger.trace(`epochTimestamp: ${epochTimestamp}, utcTimestamp: ${utcTimestamp}, timeRangeStr: ${timeRangeStr}, ${isWithinRange}`);
    return isWithinRange;
}

function convertUtcStringToEpoch(utcString) {
    return ((new Date(utcString)).getTime())/1000|0;
}

module.exports = ReportService;
