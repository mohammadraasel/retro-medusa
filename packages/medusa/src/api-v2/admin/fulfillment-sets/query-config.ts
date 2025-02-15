export const defaultAdminFulfillmentSetsFields = [
  "id",
  "name",
  "type",
  "created_at",
  "updated_at",
  "deleted_at",
  "*service_zones",
  "*service_zones.geo_zones",
]

export const retrieveTransformQueryConfig = {
  defaults: defaultAdminFulfillmentSetsFields,
  isList: false,
}

export const listTransformQueryConfig = {
  ...retrieveTransformQueryConfig,
  isList: true,
}
