#!/bin/bash

# exit setup
set -eo pipefail
# [-e] - immediately exit if any command has a non-zero exit status
# [-x] - all executed commands are printed to the terminal [not secure]
# [-o pipefail] - if any command in a pipeline fails, that return code will be used as the return code of the whole pipeline

SCRIPT_DIR=$(dirname -- "$(readlink -f -- "$0")")

echo ""
echo "Start dump UnitedStorage entries..."
echo "  - workbooks"
echo "  - collections"
echo "  - entries"
echo "  - revisions"
echo "  - links"

COMPOSE_FILE=$(readlink -f "${SCRIPT_DIR}/../../tests/docker-compose.e2e.yml")
DUMP_FILE=$(readlink -f "${SCRIPT_DIR}/../../tests/data/us-e2e-data.sql")

docker --log-level error compose -f "${COMPOSE_FILE}" exec \
    --env "POSTGRES_DUMP_CLEAR_META=true" \
    --env "POSTGRES_DUMP_SKIP_CONFLICT=false" \
    -T postgres \
    /init/us-dump.sh |
    sed -E 's|"cypher_text": "[^"]+"|"cypher_text": "{{POSTGRES_PASSWORD}}"|' |
    sed -E 's|"host": "[^"]+"|"host": "{{POSTGRES_HOST}}"|' |
    sed -E 's|"port": [^,]+,|"port": {{POSTGRES_PORT}},|' |
    sed -E 's|"db_name": "[^"]+"|"db_name": "{{POSTGRES_DB}}"|' |
    sed -E 's|"username": "[^"]+"|"username": "{{POSTGRES_USER}}"|' \
        >"${DUMP_FILE}"

EXIT="$?"

if [ "${EXIT}" != "0" ]; then
    echo "Dump error, exit..."
    exit "${EXIT}"
else
    echo ""
    echo "Dump done, saved at [${DUMP_FILE}]"
    exit 0
fi
