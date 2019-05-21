const AWS = require('aws-sdk');
const config = require('./config');
const logger = require('./logger');
const Moment = require('moment');
const MomentRange = require('moment-range');
const moment = MomentRange.extendMoment(Moment);

class ReportService {
    constructor() {}

    async generateSummaryReport(message, timeRanges) {
        logger.debug(`Generating summary report for ${message.service}`);

        const endTime = (new Date).getTime();
        const longestTimeRange = timeRanges[timeRanges.length - 1]
        const startTime = epochFromStartOfTimeRange(longestTimeRange)
        let metricResults = await getCloudWatchSLAMetrics(startTime, endTime, message.service);
        logger.trace(metricResults);

        let rangeSummaries = [];
        for (let timeRange of timeRanges) {
            let rangeSummary = calculateRangeSummary(metricResults, timeRange);
            rangeSummaries.push(
                {
                    timeRange: timeRange,
                    summary: {
                        numAttempts: rangeSummary.numAttempts,
                        numSuccesses: rangeSummary.numSuccesses,
                        successPercent: rangeSummary.successPercent,
                        failureMinutes: rangeSummary.failureMinutes,
                        numFailures: rangeSummary.numFailures,
                        numOutages: rangeSummary.numOutages
                    }
                }
            )
        }

        logger.info(rangeSummaries);
        return rangeSummaries;

    }

    async generateHistoryReport() {

    }

    async generateServicesList() {

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
        MaxDatapoints: 1000,
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
                Timestamp: cwData.MetricDataResults[0].Timestamps[i],
                Successes: cwData.MetricDataResults[0].Values[i],
                Attempts: cwData.MetricDataResults[1].Values[i],
                DurationSeconds: cwData.MetricDataResults[2].Values[i]
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
// { Timestamp: 2019-05-21T00:31:00.000Z,
//     Successes: 1,
//     Attempts: 1,
//     DurationSeconds: 18.8641 }
// timeRangeStr: string enum in format 1d, 3d, 7d, 14d, etc.
function calculateRangeSummary(metricResults, timeRangeStr) {
    logger.debug(`Calculating range summary for ${timeRangeStr}, metricResults length: ${metricResults.length}`)
    let numAttempts = 0,
        numSuccesses = 0,
        numFailures = 0,
        failureMinutes = 0,
        numOutages = 0;

    let lastStatusWasSuccess = true,
        lastTimestamp = null;
    for (let result of metricResults) {
        let prev = lastStatusWasSuccess;

        //todo
        //let timeRangeStr = determineTimeRangeFromTimestamp(result.Timestamp);
        //zzz let timeRangeStr = '1d';

        if (isTimestampWithinTimeRange(result.Timestamp, timeRangeStr)) {
            numAttempts++;
            if (result.Successes) {
                lastStatusWasSuccess = true;
                numSuccesses++;
            } else {
                lastStatusWasSuccess = false;
                numFailures++;
                if (lastTimestamp) {
                    failureMinutes += numMinutesBetweenTimestamps(result.Timestamp, lastTimestamp);
                }
                lastTimestamp = result.Timestamp;
            }
            // did the status change from the prior period?
            if (lastStatusWasSuccess != prev) {
                // each time the status changes to a failure, increment num outages
                if (result.Successes == 0) {
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

function isTimestampWithinTimeRange(timestamp, timeRangeStr) {
    let range = convertTimeRangeStrToRange(timeRangeStr);
    let isWithinRange = range.contains(timestamp);
    //logger.trace(`timestamp: ${timestamp}, timeRangeStr: ${timeRangeStr}, ${isWithinRange}`);
    return isWithinRange;
}

module.exports = ReportService
