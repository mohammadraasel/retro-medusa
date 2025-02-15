import { AdminFulfillmentAddressResponse } from "./fulfillment-address"
import { AdminFulfillmentProviderResponse } from "./fulfillment-provider"
import { AdminFulfillmentItemResponse } from "./fulfillment-item"
import { AdminFulfillmentLabelResponse } from "./fulfillment-label"

/**
 * @experimental
 */
export interface AdminFulfillmentResponse {
  id: string
  location_id: string
  packed_at: Date | null
  shipped_at: Date | null
  delivered_at: Date | null
  canceled_at: Date | null
  data: Record<string, unknown> | null
  provider_id: string
  shipping_option_id: string | null
  metadata: Record<string, unknown> | null
  provider: AdminFulfillmentProviderResponse
  delivery_address: AdminFulfillmentAddressResponse
  items: AdminFulfillmentItemResponse[]
  labels: AdminFulfillmentLabelResponse[]
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}
