#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_FILE="$SCRIPT_DIR/../template.yaml"

usage() {
  cat <<EOF
Usage: $(basename "$0") --stack-name <name> [options]

Required:
  --stack-name <name>          CloudFormation stack name

Optional:
  --region <region>            AWS region (default: us-east-1)
  --stage <stage>              Template parameter Stage (default: dev)
  --bucket-name <name>         Template parameter BucketName
  --ecr-repo-name <name>       Template parameter EcrRepoName (default: s3-events)
  --profile <profile>          AWS CLI profile name
  --help                       Show this help message

Example:
  ./scripts/deploy_template.sh --stack-name garden-dev --region us-east-1 --stage dev --bucket-name my-bucket
EOF
}

STACK_NAME=""
REGION="us-east-1"
STAGE="dev"
BUCKET_NAME=""
ECR_REPO_NAME="s3-events"
PROFILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --stack-name)
      STACK_NAME="${2:-}"
      shift 2
      ;;
    --region)
      REGION="${2:-}"
      shift 2
      ;;
    --stage)
      STAGE="${2:-}"
      shift 2
      ;;
    --bucket-name)
      BUCKET_NAME="${2:-}"
      shift 2
      ;;
    --ecr-repo-name)
      ECR_REPO_NAME="${2:-}"
      shift 2
      ;;
    --profile)
      PROFILE="${2:-}"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$STACK_NAME" ]]; then
  echo "Error: --stack-name is required." >&2
  usage
  exit 1
fi

if [[ ! -f "$TEMPLATE_FILE" ]]; then
  echo "Error: template file not found at $TEMPLATE_FILE" >&2
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "Error: aws CLI is not installed or not in PATH." >&2
  exit 127
fi

AWS_ARGS=(--region "$REGION")
if [[ -n "$PROFILE" ]]; then
  AWS_ARGS+=(--profile "$PROFILE")
fi

PARAM_OVERRIDES=(
  "Stage=$STAGE"
  "Region=$REGION"
  "EcrRepoName=$ECR_REPO_NAME"
)

if [[ -n "$BUCKET_NAME" ]]; then
  PARAM_OVERRIDES+=("BucketName=$BUCKET_NAME")
fi

echo "Validating template..."
aws cloudformation validate-template \
  "${AWS_ARGS[@]}" \
  --template-body "file://$TEMPLATE_FILE" >/dev/null

echo "Deploying stack $STACK_NAME in $REGION..."
aws cloudformation deploy \
  "${AWS_ARGS[@]}" \
  --stack-name "$STACK_NAME" \
  --template-file "$TEMPLATE_FILE" \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
  --parameter-overrides "${PARAM_OVERRIDES[@]}" \
  --no-fail-on-empty-changeset

echo "Deployment complete."
echo "Outputs:"
aws cloudformation describe-stacks \
  "${AWS_ARGS[@]}" \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs' \
  --output table
