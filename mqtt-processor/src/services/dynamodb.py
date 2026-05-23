import os
from typing import Any, Optional

import boto3


def get_dynamodb_table(logger: Any) -> Optional[Any]:
    """Initialize and return DynamoDB table client or None if unavailable."""
    try:
        dynamodb = boto3.resource(
            "dynamodb",
            region_name=os.getenv("AWS_REGION", "us-east-1"),
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        )
        table_name = os.getenv("AWS_DYNAMODB_TABLE", "GardenTelemetry")
        db_table = dynamodb.Table(table_name)
        logger.info("AWS DynamoDB pipeline initialized targeting table: %s", db_table.table_name)
        return db_table
    except Exception as exc:
        logger.warning("Failed to connect to AWS Cloud SDK: %s", exc)
        return None
