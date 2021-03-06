const fs = require("fs");
const path = require('path');

const message = {
    timestamp: 1558115155,
    succeeded: true,
    groups: [ 'all', 'devteamname' ],
    service: process.env.TEST_SERVICE || 'myservice',
    testExecutionSecs: 14.6719
}

const SNSEvent = 
{
    "Type" : "Notification",
    "MessageId" : "8dbb3a40-5079-5da1-9fae-6f18a5eaba52",
    "TopicArn" : "arn:aws:sns:us-east-1:xxx:sla-monitor-result-published-dev",
    "Message" : JSON.stringify(message),
    "Timestamp" : "2019-05-17T17:45:55.909Z",
    "SignatureVersion" : "1",
    "Signature" : "mlumWnU13UgkeVZo6Sc2wsRgufJriiat3jMOv5iTREgDTNq8+m/2mxFeDL2WOVs6IafsiRyrDB1dZd1dbSB6hOg0G88Sa5L5HJcxM0/0Ix9DNvXRMjci6lDXXWPsZBAVZgamk4aI4WEO3YrsYJCVbbE5Lh2m/yEBWh6JyGHc314FUIUDetQhh3cjIJP5bz0gpvBkwy18Q+zJ/mKeYTaDgKJ4TXRFHvtv2rLl+J9hW9yWkv4rphFPz6rChT0UrPlrb2y4W9qdgEYVqi2M6IILd1Sae3xvRJEk/C//QmkaEEExN/1mdH172qmyzU+xUolzvYcw++6YsYZw4DJNhb+JXw==",
    "SigningCertURL" : "https://sns.us-east-1.amazonaws.com/SimpleNotificationService-6aad65c2f9911b05cd53efda11f913f9.pem",
    "UnsubscribeURL" : "https://sns.us-east-1.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:us-east-1:855446687578:sla-monitor-result-published-dev:d356e5bb-0fb0-40f7-bea6-16915fd7e198"
}

const SQSEventFull =
{
    "Records": [
        {
            "messageId": "4c345603-810b-4fda-9d25-32891901f71d",
            "receiptHandle": "MessageReceiptHandle",
            "body": JSON.stringify(SNSEvent),
            "attributes": {
                "ApproximateReceiveCount": "3",
                "SentTimestamp": "1534476603214",
                "SenderId": "AIDAIT2UOQQY3AUEKVGXU",
                "ApproximateFirstReceiveTimestamp": "1534476603229"
            },
            "messageAttributes": {},
            "md5OfBody": "486fcf43c0729f744871f8b95f137ff2",
            "eventSource": "aws:sqs",
            "eventSourceARN": "arn:aws:sqs:us-east-1:123456789012:sla-monitor-reports-dev",
            "awsRegion": "us-east-1"
        }
    ]
}

// console.log(SQSEventFull)
const generatedEventPath = path.join(process.cwd(), 'generatedEvent.json');
fs.writeFile(generatedEventPath, JSON.stringify(SQSEventFull), function(err) {
    if (err) throw err;
    console.log(generatedEventPath);
});
