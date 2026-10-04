import os
from typing import Any, Optional

import boto3

import os
import boto3
from boto3.dynamodb.conditions import Key, Attr
from typing import Any, Dict, List, Protocol


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





def get_speaker_logging_service(logger: Any):
    table_name = os.environ.get("SPEAKER_LOGGING_TABLE_NAME", "SpeakerLogTable")
    region = os.environ.get("REGION","us-east-1")
    logger.debug(f"Getting handler for table: {table_name} in region: {region}")
    return DynamoDBHandler(table_name=table_name, region_name=region)


class DynamoDBConvertible(Protocol):
    @classmethod
    def convert_model_to_db_object(self) -> Dict[str, Any]:
        """Converts the model to a DynamoDB-compatible object."""
        ...

    @classmethod
    def convert_db_object_to_model(self, db_object: Dict[str, Any]) -> None:
        """Converts a DynamoDB object to the model."""
        ...


class DynamoDBHandler:
    def __init__(self, table_name: str, region_name: str):
        self.table_name = table_name
        self.region_name = region_name
        self.dynamodb = boto3.resource('dynamodb', region_name=self.region_name,
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"))
        self._table = self.dynamodb.Table(self.table_name)

    def put_item(self, data: Dict) -> DynamoDBConvertible:
        pk = data.pop("PK")
        sk = data.pop("SK")
        if not pk and not sk:
            raise ValueError("PK and SK must be provided.")
        item = {"PK": pk, "SK": sk, **data}
        response = self._table.put_item(Item=item)
        return response

    def update_item(self, pk: str, sk: str, update_expression: str, expression_attribute_values: DynamoDBConvertible) -> DynamoDBConvertible:
        key = {"PK": pk, "SK": sk}
        response = self._table.update_item(
            Key=key,
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_attribute_values,
            ReturnValues="ALL_NEW"
        )
        return response

    def delete_item(self, pk: str, sk: str) -> DynamoDBConvertible:
        key = {"PK": pk, "SK": sk}
        response = self._table.delete_item(Key=key)
        return response
    
    def query_by_primary_key(self, pk: str, sk: str) -> DynamoDBConvertible:
        key = {"PK": pk, "SK": sk}
        response = self._table.get_item(Key=key)
        return response.get('Item', None)

    def query_by_sort_key(self, key: str) -> DynamoDBConvertible:
        return self._table.query(
            IndexName="GSI1",
            KeyConditionExpression=Key("SK").eq(key)
        )["Items"]   
    
    def query_by_search_key(self, key: str) -> List[DynamoDBConvertible]:
        return self._table.query(
            IndexName="SearchIndex",
            KeyConditionExpression=Key("search_attribute").eq(key)
        )["Items"] 
    
    def query_by_search_field_within_range_from_params(self, start_date_str: str, end_date_str):
        """ 
            Performs the query with a date range on the search_attribute using index
            Requires a model where the search_attribute is a date
        """
        key_condition = Key("search_attribute").between(
            start_date_str, end_date_str
        )
        return self._table.query(IndexName = "SearchIndex",
                                 KeyConditionExpression=key_condition)


    def query_by_sort_key_with_date_filter(self, sk: str, date_field_name: str, start_date: str, end_date: str) -> DynamoDBConvertible:
        """
        Queries records by SK on the GSI1 index and filters them by a date range 
        
        :param sk: The sort key value to query.
        :param date_field_name: The name of the date field to filter by.
        :param start_date: The start of the date range (inclusive).
        :param end_date: The end of the date range (inclusive).
        :return: A list of matching items.
        """
        response = self._table.query(
            IndexName="GSI1",
            KeyConditionExpression=Key("SK").eq(sk),
            FilterExpression=Attr(date_field_name).between(start_date, end_date)
        )
        return response["Items"]

    def query_by_sort_key_with_filter_field(self, sk: str, filter_field_name: str, filter_field_value: str) -> DynamoDBConvertible:
        """
        Queries records by SK on the GSI1 index and filters by another field
        
        :param sk: The sort key value to query.
        :param filter_field_name: The name of the field to filter by.
        :param filter_field_value: The value to filter by.
        :return: A list of matching items.
        """
        response = self._table.query(
            IndexName="GSI1",
            KeyConditionExpression=Key("SK").eq(sk),
            FilterExpression=Attr(filter_field_name).eq(filter_field_value)  # Second condition
        )
        return response["Items"]
    
    def query_by_sort_key_with_date_filter_and_filter_field(self, sk: str, date_field_name: str, filter_field_name: str, start_date: str, end_date: str, filter_field_value: Any) -> DynamoDBConvertible:
        """
        Queries records by SK on the GSI1 index and filters them by a date range 
        
        :param sk: The sort key value to query.
        :param date_field_name: The name of the date field to filter by.
        :param filter_field_name: The name of the field to filter by.
        :param start_date: The start of the date range (inclusive).
        :param end_date: The end of the date range (inclusive).
        :param filter_field_value: The value to filter by.
        :return: A list of matching items.
        """
        response = self._table.query(
            IndexName="GSI1",
            KeyConditionExpression=Key("SK").eq(sk),
            FilterExpression=(
                Attr(date_field_name).between(start_date, end_date) &  # First condition
                Attr(filter_field_name).eq(filter_field_value)  # Second condition
            )
        )
        return response["Items"]
    
    def query_by_search_field_within_range(self, start_date_str: str, end_date_str):
        """ 
            Performs the query with a date range on the search_attribute
            Requires a model where the search_attribute is a date
        """
        key_condition = Key("search_attribute").between(
            start_date_str, end_date_str
        )
        return self._table.query(IndexName = "SearchIndex",
                                 KeyConditionExpression=key_condition)

    def query_by_pk_sortkey_field_within_range(self, key: str, start_date_str: str, end_date_str):
        """ 
            Performs the query with a date range on the sort key
            Requires a model where the PK is given and the SK is a date
        """
        key_condition = Key(PK).eq(key) & Key(SK).between(
            start_date_str, end_date_str
        )
        return self._table.query(KeyConditionExpression=key_condition)

