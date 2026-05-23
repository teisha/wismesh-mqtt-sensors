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
