from datetime import datetime, timezone

from src.models.speaker_log import SpeakerLogEntry
from src.services.dynamodb import get_dynamodb_table


def test_get_dynamodb_table_success(mocker):
    logger = mocker.Mock()
    mock_table = mocker.Mock()
    mock_table.table_name = "GardenTelemetry"
    mock_resource = mocker.Mock()
    mock_resource.Table.return_value = mock_table

    mocker.patch("src.services.dynamodb.boto3.resource", return_value=mock_resource)

    table = get_dynamodb_table(logger)

    assert table is mock_table
    logger.info.assert_called_once_with(
        "AWS DynamoDB pipeline initialized targeting table: %s",
        "GardenTelemetry",
    )


def test_get_dynamodb_table_failure_returns_none(mocker):
    logger = mocker.Mock()
    mocker.patch("src.services.dynamodb.boto3.resource", side_effect=Exception("boom"))

    table = get_dynamodb_table(logger)

    assert table is None
    logger.warning.assert_called_once()


def test_speaker_log_get_by_topic_range(mocker):
    mock_service = mocker.Mock()
    mock_service._table.query.return_value = {
        "Items": [{
            "PK": "TOPIC|sensor/temperature",
            "SK": "2026-10-04T12:00:00Z",
            "payload": {"value": 42},
            "raw_message": "{\"value\": 42}",
            "message_id": "abc-123",
        }]
    }
    mocker.patch("src.models.speaker_log.get_speaker_logging_service", return_value=mock_service)

    start = datetime(2026, 10, 4, 11, 0, tzinfo=timezone.utc)
    end = datetime(2026, 10, 4, 13, 0, tzinfo=timezone.utc)

    entries = SpeakerLogEntry.get_by_topic_range("sensor/temperature", start, end)

    assert len(entries) == 1
    assert entries[0].topic == "sensor/temperature"
    assert entries[0].payload == {"value": 42}
    mock_service._table.query.assert_called_once()
    key_condition = mock_service._table.query.call_args.kwargs["KeyConditionExpression"]
    assert key_condition is not None
