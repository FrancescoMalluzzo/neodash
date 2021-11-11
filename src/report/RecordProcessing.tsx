import _ from 'lodash';

const OPTIONAL_FIELD_UNAVAILABLE_IDENTIFIER = "(none)";


/**
 * Renames records based on a configured property selection.
 * @param records : a list of Neo4j records.
 * @param selection : a dictionary of record field name mappings.
 * @returns records : the same set of records, but with cleaned up and renamed records that the visualization needs.
 */
export function mapRecords(records: any, selection: any, textFields: any, numericFields: any, optionalFields: any, defaultKeyField: str) {

    // if: We have null records, or, an empty result set, or, no specified selection, we return the original record set.
    if (!records || records.length == 0 || Object.keys(selection).length == 0) {
        return records;
    }

    // Use the first row + the selection dict to create a mapping from the actual --> expected fields.
    const fieldLookup = createMappedFieldLookup(records[0], selection, optionalFields)
    const keys = Object.keys(fieldLookup)
    const defaultKey = selection[defaultKeyField] ? selection[defaultKeyField] : "";
    const mappedRecords = records
        .map(r => mapSingleRecord(r, fieldLookup, keys, defaultKey, textFields, numericFields, optionalFields))
        .filter(r => r != null);

    // Check if we have non-zero records for all of the numeric fields, if not, we can't visualize anything.
    // We have to check this explicitly otherwise some visualizations will break...
    if (mappedRecords.every(record => { return numericFields.every(name => record._fields[record._fieldLookup[name]] == 0) })) {
        return null;
    }
    return mappedRecords;
}

/**
 * Create a record fieldlookup array for the mapped set of field names.
 * 
 * Input:
 * - record: (fieldlookup={Category=0, Value=1, Group=2}, values=["A",53.2,"X"])
 * - selection {expectedFieldName:actualFieldName}: {index=Category, value=Value, key=Group}
 * Output:
 * - (fieldlookup={index=0, value=1, key=2}
 * 
 * 
 * Alternative, for multiple selections:
 * 
 * Input:
 * - record: (fieldlookup={X=0, Y1=1, Y2=2}, values=[1,6,66])
 * - selection {expectedFieldName:actualFieldName}: {x=X, y=[Y1,Y2]}
 * Output:
 * - (fieldlookup={x=0, y1=1, y2=2}
 */
export function createMappedFieldLookup(record: any, selection: any, optionalFieldNames: any) {
    const newFieldLookup = {}
    Object.keys(selection).forEach(expectedFieldName => {
        const actualFieldName = selection[expectedFieldName];

        if (Array.isArray(actualFieldName)) {
            // If we have a multiselected array, we append the expected field name with the index of the actual field in the list.
            actualFieldName.forEach((field, index) => {
                if (record._fieldLookup[field] != undefined) {
                    newFieldLookup[expectedFieldName + "(" + field + ")"] = record._fieldLookup[field];
                }
            })
        } else if (record._fieldLookup[actualFieldName] != undefined) {
            // If we have the actual field name in the record, we swap it out with the new field lookup.
            newFieldLookup[expectedFieldName] = record._fieldLookup[actualFieldName];
        } else {
            // If we don't have the actual field name in the record,
            // and we explicitly specified this as (none), we can infer the value from another field.
            // And put at the back of the record array.
            // TODO - this might not work if we have more than one optional field specified.
            // TODO - this won't work if there's an optional field that is also a multiselect.
            if (actualFieldName == OPTIONAL_FIELD_UNAVAILABLE_IDENTIFIER && optionalFieldNames.indexOf(expectedFieldName) != -1) {
                newFieldLookup[expectedFieldName] = record._fields.length + optionalFieldNames.indexOf(expectedFieldName);
            }
        }
    });
    return newFieldLookup;
}

/**
 * Maps a single record from original query output to visualization expected output.
 * @param record : a single neo4j data record.
 * @param fieldLookup : an (overridden) fieldlookup property for the record.
 * @param keys : an (overridden) keys property for the record.
 * @param defaultKey : if the record is missing a 'key' field, a default value for the field.
 * @returns the mapped record.
 */
export function mapSingleRecord(record, fieldLookup, keys, defaultKey, textFieldNames, numericFieldNames, optionalFieldNames) {
    record._fieldLookup = fieldLookup;
    record.keys = keys;

    // If we don't have a key field available, use the provided keyFieldName as a key value.
    // TODO - this might not work for reports with >1 optional values.
    optionalFieldNames.forEach(optionalFieldName => {
        if (record._fieldLookup[optionalFieldName] >= record._fields.length) {
            record._fields.push(defaultKey)
        }
    });

    // Ensure that fields specified as numeric contain numbers. If not, return the record as null (invalid)
    if (numericFieldNames.some(numericFieldName => (isNaN(record._fields[record._fieldLookup[numericFieldName]])))) {
        return null;
    }

    textFieldNames.forEach(textFieldName => {
        record._fields[record._fieldLookup[textFieldName]] =
            convertRecordObjectToString(record._fields[record._fieldLookup[textFieldName]]);
    })

    return record;
}

/**
 * Converts a neo4j record entry to a readable string representation. 
 */
const convertRecordObjectToString = (entry) => {
    if (entry == null || entry == undefined) {
        return entry;
    }
    const className = entry.__proto__.constructor.name;
    if (className == "String") {
        return entry;
    } else if (valueIsNode(entry)) {
        return convertNodeToString(entry);
    } else if (valueIsRelationship(entry)) {
        return convertRelationshipToString(entry);
    } else if (valueIsPath(entry)) {
        return convertPathToString(entry);
    }
    return entry.toString();
}

/**
 * Converts a neo4j node record entry to a readable string representation. 
 * if it's a fieldType =="Node"
 * Then, return
 * 1. 'name' property, if it exists,
 * 2. the 'title' property, if it exists,
 * 3. the 'id' property, if it exists...
 * 4. the 'uid' property, if it exists..
 * 5. the ({labels}}, if they exist,
 * 6. Node(id).
 */
const convertNodeToString = (nodeEntry => {
    if (nodeEntry.properties.name) {
        return nodeEntry.labels + "(" + nodeEntry.properties.name + ")";
    }
    if (nodeEntry.properties.title) {
        return nodeEntry.labels + "(" + nodeEntry.properties.title + ")";
    }
    if (nodeEntry.properties.id) {
        return nodeEntry.labels + "(" + nodeEntry.properties.id + ")";
    }
    if (nodeEntry.properties.uid) {
        return nodeEntry.labels + "(" + nodeEntry.properties.uid + ")";
    }
    return nodeEntry.labels + "(" + "_id=" + nodeEntry.identity + ")";
});


// if it's a fieldType == "Relationship"
const convertRelationshipToString = (relEntry => {
    return relEntry.toString();
});

// if it's a fieldType == "Path"
const convertPathToString = (pathEntry => {
    return pathEntry.toString();
});
// Anything else, return the string representation of the object.

/**
 * Collects all node labels and node properties in a set of Neo4j records.
 * @param records : a list of Neo4j records.
 * @returns a list of lists, where each inner list is [NodeLabel] + [prop1, prop2, prop3]...
 */
export function extractNodePropertiesFromRecords(records: any) {
    const fieldsDict = {}
    records.forEach(record => {
        record._fields.forEach((field, i) => {
            saveNodePropertiesToDictionary(field, fieldsDict);
        })
    });
    const fields = Object.keys(fieldsDict).map(label => {
        return [label].concat(Object.values(fieldsDict[label]));
    })
    return fields.length > 0 ? fields : [["Error"]];
}

export function saveNodePropertiesToDictionary(field, fieldsDict) {
    if (field == undefined) {
        return
    }
    if (valueIsArray(field)) {
        field.forEach((v, i) => saveNodePropertiesToDictionary(v, fieldsDict));
    } else if(valueIsNode(field)) {
        field.labels.forEach(l => {
            fieldsDict[l] = (fieldsDict[l]) ? _.merge(fieldsDict[l], Object.keys(field.properties)) : Object.keys(field.properties)
        });
    } else if (valueIsPath(field)) {
        field.segments.forEach((segment, i) => {
            saveNodePropertiesToDictionary(segment.start, fieldsDict);
            saveNodePropertiesToDictionary(segment.end, fieldsDict);
        });
    }
}

/* HELPER FUNCTIONS FOR DETERMINING TYPE OF FIELD RETURNED FROM NEO4J */

export function valueIsArray(value) {
    const className = value.__proto__.constructor.name;
    return className == "Array";
}

export function valueIsNode(value) {
    // const className = value.__proto__.constructor.name;
    // return className == "Node";
    return (value && value["labels"] && value["identity"] && value["properties"]);
}

export function valueIsRelationship(value) {
    // const className = value.__proto__.constructor.name;
    // return className == "Relationship";
    return (value && value["type"] && value["start"] && value["end"] && value["identity"] && value["properties"]);
}

export function valueIsPath(value) {
    // const className = value.__proto__.constructor.name;
    // return className == "Path"
    return (value && value["start"] && value["end"] && value["segments"] && value["length"]);
}

export function valueIsObject(value) {
    const className = value.__proto__.constructor.name;
    return className == "Object";
}
