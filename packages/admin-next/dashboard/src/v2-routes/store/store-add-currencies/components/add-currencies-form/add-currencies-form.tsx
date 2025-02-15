import { Currency } from "@medusajs/medusa"
import { Button, Checkbox, Hint, Tooltip } from "@medusajs/ui"
import {
  OnChangeFn,
  RowSelectionState,
  createColumnHelper,
} from "@tanstack/react-table"
import { adminCurrenciesKeys, useAdminCustomQuery } from "medusa-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import * as zod from "zod"

import { zodResolver } from "@hookform/resolvers/zod"
import { CurrencyDTO, StoreDTO } from "@medusajs/types"
import { useForm } from "react-hook-form"
import {
  RouteFocusModal,
  useRouteModal,
} from "../../../../../components/route-modal"
import { DataTable } from "../../../../../components/table/data-table"
import { useDataTable } from "../../../../../hooks/use-data-table"
import { useCurrenciesTableColumns } from "../../../common/hooks/use-currencies-table-columns"
import { useCurrenciesTableQuery } from "../../../common/hooks/use-currencies-table-query"
import { useUpdateStore } from "../../../../../hooks/api/store"

type AddCurrenciesFormProps = {
  store: StoreDTO
}

const AddCurrenciesSchema = zod.object({
  currencies: zod.array(zod.string()).min(1),
})

const PAGE_SIZE = 50
const PREFIX = "ac"

export const AddCurrenciesForm = ({ store }: AddCurrenciesFormProps) => {
  const { t } = useTranslation()
  const { handleSuccess } = useRouteModal()

  const form = useForm<zod.infer<typeof AddCurrenciesSchema>>({
    defaultValues: {
      currencies: [],
    },
    resolver: zodResolver(AddCurrenciesSchema),
  })

  const { setValue } = form

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const updater: OnChangeFn<RowSelectionState> = (fn) => {
    const updated = typeof fn === "function" ? fn(rowSelection) : fn

    const ids = Object.keys(updated)

    setValue("currencies", ids, {
      shouldDirty: true,
      shouldTouch: true,
    })

    setRowSelection(updated)
  }

  const { raw, searchParams } = useCurrenciesTableQuery({
    pageSize: 50,
    prefix: PREFIX,
  })

  const { data, isLoading, isError, error } = useAdminCustomQuery(
    "/admin/currencies",
    adminCurrenciesKeys.list(raw),
    searchParams,
    {
      keepPreviousData: true,
    }
  )

  const preSelectedRows = store.supported_currency_codes.map((c) => c)

  const columns = useColumns()

  const { table } = useDataTable({
    data: (data?.currencies ?? []) as CurrencyDTO[],
    columns,
    count: data?.count,
    getRowId: (row) => row.code,
    enableRowSelection: (row) => !preSelectedRows.includes(row.original.code),
    enablePagination: true,
    pageSize: PAGE_SIZE,
    prefix: PREFIX,
    rowSelection: {
      state: rowSelection,
      updater,
    },
  })

  const { mutateAsync, isLoading: isMutating } = useUpdateStore(store.id)

  const handleSubmit = form.handleSubmit(async (data) => {
    const currencies = Array.from(
      new Set([...data.currencies, ...preSelectedRows])
    ) as string[]

    await mutateAsync(
      {
        supported_currency_codes: currencies,
      },
      {
        onSuccess: () => {
          handleSuccess()
        },
      }
    )
  })

  if (isError) {
    throw error
  }

  return (
    <RouteFocusModal.Form form={form}>
      <form
        onSubmit={handleSubmit}
        className="flex h-full flex-col overflow-hidden"
      >
        <RouteFocusModal.Header>
          <div className="flex flex-1 items-center justify-between">
            <div className="flex items-center">
              {form.formState.errors.currencies && (
                <Hint variant="error">
                  {form.formState.errors.currencies.message}
                </Hint>
              )}
            </div>
            <div className="flex items-center justify-end gap-x-2">
              <RouteFocusModal.Close asChild>
                <Button size="small" variant="secondary">
                  {t("actions.cancel")}
                </Button>
              </RouteFocusModal.Close>
              <Button size="small" type="submit" isLoading={isMutating}>
                {t("actions.save")}
              </Button>
            </div>
          </div>
        </RouteFocusModal.Header>
        <RouteFocusModal.Body className="flex flex-1 flex-col overflow-hidden">
          <DataTable
            table={table}
            pageSize={PAGE_SIZE}
            count={data?.count}
            columns={columns}
            layout="fill"
            pagination
            search
            prefix={PREFIX}
            orderBy={["code", "name"]}
            isLoading={isLoading}
            queryObject={raw}
          />
        </RouteFocusModal.Body>
      </form>
    </RouteFocusModal.Form>
  )
}

const columnHelper = createColumnHelper<Currency>()

const useColumns = () => {
  const { t } = useTranslation()
  const base = useCurrenciesTableColumns()

  return useMemo(
    () => [
      columnHelper.display({
        id: "select",
        header: ({ table }) => {
          return (
            <Checkbox
              checked={
                table.getIsSomePageRowsSelected()
                  ? "indeterminate"
                  : table.getIsAllPageRowsSelected()
              }
              onCheckedChange={(value) =>
                table.toggleAllPageRowsSelected(!!value)
              }
            />
          )
        },
        cell: ({ row }) => {
          const isPreSelected = !row.getCanSelect()
          const isSelected = row.getIsSelected() || isPreSelected

          const Component = (
            <Checkbox
              checked={isSelected}
              disabled={isPreSelected}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              onClick={(e) => {
                e.stopPropagation()
              }}
            />
          )

          if (isPreSelected) {
            return (
              <Tooltip content={t("store.currencyAlreadyAdded")} side="right">
                {Component}
              </Tooltip>
            )
          }

          return Component
        },
      }),
      ...base,
    ],
    [t, base]
  )
}
