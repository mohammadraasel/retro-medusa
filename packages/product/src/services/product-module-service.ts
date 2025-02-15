import {
  Context,
  DAL,
  IEventBusModuleService,
  InternalModuleDeclaration,
  ModuleJoinerConfig,
  ModulesSdkTypes,
  ProductTypes,
} from "@medusajs/types"
import {
  Image,
  Product,
  ProductCategory,
  ProductCollection,
  ProductOption,
  ProductOptionValue,
  ProductTag,
  ProductType,
  ProductVariant,
  ProductVariantOption,
} from "@models"
import {
  ProductCategoryService,
  ProductCollectionService,
  ProductOptionService,
  ProductService,
  ProductTagService,
  ProductTypeService,
} from "@services"

import {
  arrayDifference,
  InjectManager,
  InjectTransactionManager,
  isString,
  kebabCase,
  MedusaContext,
  MedusaError,
  ModulesSdkUtils,
  ProductStatus,
  promiseAll,
} from "@medusajs/utils"
import {
  ProductCategoryEventData,
  ProductCategoryEvents,
  ProductCollectionEventData,
  ProductCollectionEvents,
  ProductEventData,
  ProductEvents,
  UpdateCollectionInput,
  UpdateProductInput,
  UpdateProductOptionInput,
  UpdateProductVariantInput,
  UpdateTypeInput,
} from "../types"
import { entityNameToLinkableKeysMap, joinerConfig } from "./../joiner-config"

type InjectedDependencies = {
  baseRepository: DAL.RepositoryService
  productService: ProductService<any>
  productVariantService: ModulesSdkTypes.InternalModuleService<any, any>
  productTagService: ProductTagService<any>
  productCategoryService: ProductCategoryService<any>
  productCollectionService: ProductCollectionService<any>
  productImageService: ModulesSdkTypes.InternalModuleService<any>
  productTypeService: ProductTypeService<any>
  productOptionService: ProductOptionService<any>
  productOptionValueService: ModulesSdkTypes.InternalModuleService<any>
  productVariantOptionService: ModulesSdkTypes.InternalModuleService<any>
  eventBusModuleService?: IEventBusModuleService
}

const generateMethodForModels = [
  { model: ProductCategory, singular: "Category", plural: "Categories" },
  { model: ProductCollection, singular: "Collection", plural: "Collections" },
  { model: ProductOption, singular: "Option", plural: "Options" },
  { model: ProductTag, singular: "Tag", plural: "Tags" },
  { model: ProductType, singular: "Type", plural: "Types" },
  { model: ProductVariant, singular: "Variant", plural: "Variants" },
  {
    model: ProductVariantOption,
    singular: "VariantOption",
    plural: "VariantOptions",
  },
]

export default class ProductModuleService<
    TProduct extends Product = Product,
    TProductVariant extends ProductVariant = ProductVariant,
    TProductTag extends ProductTag = ProductTag,
    TProductCollection extends ProductCollection = ProductCollection,
    TProductCategory extends ProductCategory = ProductCategory,
    TProductImage extends Image = Image,
    TProductType extends ProductType = ProductType,
    TProductOption extends ProductOption = ProductOption,
    TProductOptionValue extends ProductOptionValue = ProductOptionValue,
    TProductVariantOption extends ProductVariantOption = ProductVariantOption
  >
  extends ModulesSdkUtils.abstractModuleServiceFactory<
    InjectedDependencies,
    ProductTypes.ProductDTO,
    {
      ProductCategory: {
        dto: ProductTypes.ProductCategoryDTO
        singular: "Category"
        plural: "Categories"
      }
      ProductCollection: {
        dto: ProductTypes.ProductCollectionDTO
        singular: "Collection"
        plural: "Collections"
      }
      ProductOption: {
        dto: ProductTypes.ProductOptionDTO
        singular: "Option"
        plural: "Options"
      }
      ProductTag: {
        dto: ProductTypes.ProductTagDTO
        singular: "Tag"
        plural: "Tags"
      }
      ProductType: {
        dto: ProductTypes.ProductTypeDTO
        singular: "Type"
        plural: "Types"
      }
      ProductVariant: {
        dto: ProductTypes.ProductVariantDTO
        singular: "Variant"
        plural: "Variants"
      }
      VariantOption: {
        dto: ProductTypes.ProductVariantOptionDTO
        singular: "VariantOption"
        plural: "VariantOptions"
      }
    }
  >(Product, generateMethodForModels, entityNameToLinkableKeysMap)
  implements ProductTypes.IProductModuleService
{
  protected baseRepository_: DAL.RepositoryService
  protected readonly productService_: ProductService<TProduct>
  // eslint-disable-next-line max-len
  protected readonly productVariantService_: ModulesSdkTypes.InternalModuleService<TProductVariant>

  // eslint-disable-next-line max-len
  protected readonly productCategoryService_: ProductCategoryService<TProductCategory>
  protected readonly productTagService_: ProductTagService<TProductTag>
  // eslint-disable-next-line max-len
  protected readonly productCollectionService_: ProductCollectionService<TProductCollection>
  // eslint-disable-next-line max-len
  protected readonly productImageService_: ModulesSdkTypes.InternalModuleService<TProductImage>
  protected readonly productTypeService_: ProductTypeService<TProductType>
  protected readonly productOptionService_: ProductOptionService<TProductOption>
  // eslint-disable-next-line max-len
  protected readonly productVariantOptionService_: ModulesSdkTypes.InternalModuleService<TProductVariantOption>
  // eslint-disable-next-line max-len
  protected readonly productOptionValueService_: ModulesSdkTypes.InternalModuleService<TProductOptionValue>
  protected readonly eventBusModuleService_?: IEventBusModuleService

  constructor(
    {
      baseRepository,
      productService,
      productVariantService,
      productTagService,
      productCategoryService,
      productCollectionService,
      productImageService,
      productTypeService,
      productOptionService,
      productOptionValueService,
      productVariantOptionService,
      eventBusModuleService,
    }: InjectedDependencies,
    protected readonly moduleDeclaration: InternalModuleDeclaration
  ) {
    // @ts-ignore
    // eslint-disable-next-line prefer-rest-params
    super(...arguments)

    this.baseRepository_ = baseRepository
    this.productService_ = productService
    this.productVariantService_ = productVariantService
    this.productTagService_ = productTagService
    this.productCategoryService_ = productCategoryService
    this.productCollectionService_ = productCollectionService
    this.productImageService_ = productImageService
    this.productTypeService_ = productTypeService
    this.productOptionService_ = productOptionService
    this.productOptionValueService_ = productOptionValueService
    this.productVariantOptionService_ = productVariantOptionService
    this.eventBusModuleService_ = eventBusModuleService
  }

  __joinerConfig(): ModuleJoinerConfig {
    return joinerConfig
  }

  // TODO: Add options validation, among other things
  createVariants(
    data: ProductTypes.CreateProductVariantDTO[],
    sharedContext?: Context
  ): Promise<ProductTypes.ProductVariantDTO[]>
  createVariants(
    data: ProductTypes.CreateProductVariantDTO,
    sharedContext?: Context
  ): Promise<ProductTypes.ProductVariantDTO>

  @InjectManager("baseRepository_")
  async createVariants(
    data:
      | ProductTypes.CreateProductVariantDTO[]
      | ProductTypes.CreateProductVariantDTO,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<
    ProductTypes.ProductVariantDTO[] | ProductTypes.ProductVariantDTO
  > {
    const input = Array.isArray(data) ? data : [data]

    const variants = await this.createVariants_(input, sharedContext)

    const createdVariants = await this.baseRepository_.serialize<
      ProductTypes.ProductVariantDTO[]
    >(variants)

    return Array.isArray(data) ? createdVariants : createdVariants[0]
  }

  @InjectTransactionManager("baseRepository_")
  protected async createVariants_(
    data: ProductTypes.CreateProductVariantDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ProductVariant[]> {
    if (data.some((v) => !v.product_id)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Tried to create variants without specifying a product_id"
      )
    }

    const productOptions = await this.productOptionService_.list(
      {
        product_id: [...new Set<string>(data.map((v) => v.product_id!))],
      },
      {
        take: null,
        relations: ["values"],
      },
      sharedContext
    )

    const productVariantsWithOptions =
      ProductModuleService.assignOptionsToVariants(data, productOptions)

    return await this.productVariantService_.create(
      productVariantsWithOptions,
      sharedContext
    )
  }

  async upsertVariants(
    data: ProductTypes.UpsertProductVariantDTO[],
    sharedContext?: Context
  ): Promise<ProductTypes.ProductVariantDTO[]>
  async upsertVariants(
    data: ProductTypes.UpsertProductVariantDTO,
    sharedContext?: Context
  ): Promise<ProductTypes.ProductVariantDTO>

  @InjectTransactionManager("baseRepository_")
  async upsertVariants(
    data:
      | ProductTypes.UpsertProductVariantDTO[]
      | ProductTypes.UpsertProductVariantDTO,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<
    ProductTypes.ProductVariantDTO[] | ProductTypes.ProductVariantDTO
  > {
    const input = Array.isArray(data) ? data : [data]
    const forUpdate = input.filter(
      (variant): variant is UpdateProductVariantInput => !!variant.id
    )
    const forCreate = input.filter(
      (variant): variant is ProductTypes.CreateProductVariantDTO => !variant.id
    )

    let created: ProductVariant[] = []
    let updated: ProductVariant[] = []

    if (forCreate.length) {
      created = await this.createVariants_(forCreate, sharedContext)
    }
    if (forUpdate.length) {
      updated = await this.updateVariants_(forUpdate, sharedContext)
    }

    const result = [...created, ...updated]
    const allVariants = await this.baseRepository_.serialize<
      ProductTypes.ProductVariantDTO[] | ProductTypes.ProductVariantDTO
    >(result)

    return Array.isArray(data) ? allVariants : allVariants[0]
  }

  updateVariants(
    id: string,
    data: ProductTypes.UpdateProductVariantDTO,
    sharedContext?: Context
  ): Promise<ProductTypes.ProductVariantDTO>
  updateVariants(
    selector: ProductTypes.FilterableProductVariantProps,
    data: ProductTypes.UpdateProductVariantDTO,
    sharedContext?: Context
  ): Promise<ProductTypes.ProductVariantDTO[]>

  @InjectManager("baseRepository_")
  async updateVariants(
    idOrSelector: string | ProductTypes.FilterableProductVariantProps,
    data: ProductTypes.UpdateProductVariantDTO,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<
    ProductTypes.ProductVariantDTO[] | ProductTypes.ProductVariantDTO
  > {
    let normalizedInput: UpdateProductVariantInput[] = []
    if (isString(idOrSelector)) {
      normalizedInput = [{ id: idOrSelector, ...data }]
    } else {
      const variants = await this.productVariantService_.list(
        idOrSelector,
        {},
        sharedContext
      )

      normalizedInput = variants.map((variant) => ({
        id: variant.id,
        ...data,
      }))
    }

    const variants = await this.updateVariants_(normalizedInput, sharedContext)

    const updatedVariants = await this.baseRepository_.serialize<
      ProductTypes.ProductVariantDTO[]
    >(variants)

    return isString(idOrSelector) ? updatedVariants[0] : updatedVariants
  }

  @InjectTransactionManager("baseRepository_")
  protected async updateVariants_(
    data: UpdateProductVariantInput[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<TProductVariant[]> {
    // Validation step
    const variantIdsToUpdate = data.map(({ id }) => id)
    const variants = await this.productVariantService_.list(
      { id: variantIdsToUpdate },
      { relations: ["options"], take: null },
      sharedContext
    )
    if (variants.length !== data.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Cannot update non-existing variants with ids: ${arrayDifference(
          variantIdsToUpdate,
          variants.map(({ id }) => id)
        ).join(", ")}`
      )
    }

    // Data normalization
    const variantsWithProductId: UpdateProductVariantInput[] = variants.map(
      (v) => ({
        ...data.find((d) => d.id === v.id),
        id: v.id,
        product_id: v.product_id,
      })
    )

    const productOptions = await this.productOptionService_.list(
      {
        product_id: Array.from(
          new Set(variantsWithProductId.map((v) => v.product_id!))
        ),
      },
      { take: null },
      sharedContext
    )

    return this.productVariantService_.upsertWithReplace(
      ProductModuleService.assignOptionsToVariants(
        variantsWithProductId,
        productOptions
      ),
      {
        relations: ["options"],
      },
      sharedContext
    )
  }

  @InjectTransactionManager("baseRepository_")
  async createTags(
    data: ProductTypes.CreateProductTagDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ProductTypes.ProductTagDTO[]> {
    const productTags = await this.productTagService_.create(
      data,
      sharedContext
    )

    return await this.baseRepository_.serialize(productTags)
  }

  @InjectTransactionManager("baseRepository_")
  async updateTags(
    data: ProductTypes.UpdateProductTagDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ProductTypes.ProductTagDTO[]> {
    const productTags = await this.productTagService_.update(
      data,
      sharedContext
    )

    return await this.baseRepository_.serialize(productTags)
  }

  createTypes(
    data: ProductTypes.CreateProductTypeDTO[],
    sharedContext?: Context
  ): Promise<ProductTypes.ProductTypeDTO[]>
  createTypes(
    data: ProductTypes.CreateProductTypeDTO,
    sharedContext?: Context
  ): Promise<ProductTypes.ProductTypeDTO>

  @InjectManager("baseRepository_")
  async createTypes(
    data:
      | ProductTypes.CreateProductTypeDTO[]
      | ProductTypes.CreateProductTypeDTO,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ProductTypes.ProductTypeDTO[] | ProductTypes.ProductTypeDTO> {
    const input = Array.isArray(data) ? data : [data]

    const types = await this.productTypeService_.create(input, sharedContext)

    const createdTypes = await this.baseRepository_.serialize<
      ProductTypes.ProductTypeDTO[]
    >(types)

    return Array.isArray(data) ? createdTypes : createdTypes[0]
  }

  async upsertTypes(
    data: ProductTypes.UpsertProductTypeDTO[],
    sharedContext?: Context
  ): Promise<ProductTypes.ProductTypeDTO[]>
  async upsertTypes(
    data: ProductTypes.UpsertProductTypeDTO,
    sharedContext?: Context
  ): Promise<ProductTypes.ProductTypeDTO>

  @InjectTransactionManager("baseRepository_")
  async upsertTypes(
    data:
      | ProductTypes.UpsertProductTypeDTO[]
      | ProductTypes.UpsertProductTypeDTO,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ProductTypes.ProductTypeDTO[] | ProductTypes.ProductTypeDTO> {
    const input = Array.isArray(data) ? data : [data]
    const forUpdate = input.filter((type): type is UpdateTypeInput => !!type.id)
    const forCreate = input.filter(
      (type): type is ProductTypes.CreateProductTypeDTO => !type.id
    )

    let created: ProductType[] = []
    let updated: ProductType[] = []

    if (forCreate.length) {
      created = await this.productTypeService_.create(forCreate, sharedContext)
    }
    if (forUpdate.length) {
      updated = await this.productTypeService_.update(forUpdate, sharedContext)
    }

    const result = [...created, ...updated]
    const allTypes = await this.baseRepository_.serialize<
      ProductTypes.ProductTypeDTO[] | ProductTypes.ProductTypeDTO
    >(result)

    return Array.isArray(data) ? allTypes : allTypes[0]
  }

  updateTypes(
    id: string,
    data: ProductTypes.UpdateProductTypeDTO,
    sharedContext?: Context
  ): Promise<ProductTypes.ProductTypeDTO>
  updateTypes(
    selector: ProductTypes.FilterableProductTypeProps,
    data: ProductTypes.UpdateProductTypeDTO,
    sharedContext?: Context
  ): Promise<ProductTypes.ProductTypeDTO[]>

  @InjectManager("baseRepository_")
  async updateTypes(
    idOrSelector: string | ProductTypes.FilterableProductTypeProps,
    data: ProductTypes.UpdateProductTypeDTO,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ProductTypes.ProductTypeDTO[] | ProductTypes.ProductTypeDTO> {
    let normalizedInput: UpdateTypeInput[] = []
    if (isString(idOrSelector)) {
      // Check if the type exists in the first place
      await this.productTypeService_.retrieve(idOrSelector, {}, sharedContext)
      normalizedInput = [{ id: idOrSelector, ...data }]
    } else {
      const types = await this.productTypeService_.list(
        idOrSelector,
        {},
        sharedContext
      )

      normalizedInput = types.map((type) => ({
        id: type.id,
        ...data,
      }))
    }

    const types = await this.productTypeService_.update(
      normalizedInput,
      sharedContext
    )

    const updatedTypes = await this.baseRepository_.serialize<
      ProductTypes.ProductTypeDTO[]
    >(types)

    return isString(idOrSelector) ? updatedTypes[0] : updatedTypes
  }

  createOptions(
    data: ProductTypes.CreateProductOptionDTO[],
    sharedContext?: Context
  ): Promise<ProductTypes.ProductOptionDTO[]>
  createOptions(
    data: ProductTypes.CreateProductOptionDTO,
    sharedContext?: Context
  ): Promise<ProductTypes.ProductOptionDTO>

  @InjectManager("baseRepository_")
  async createOptions(
    data:
      | ProductTypes.CreateProductOptionDTO[]
      | ProductTypes.CreateProductOptionDTO,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ProductTypes.ProductOptionDTO[] | ProductTypes.ProductOptionDTO> {
    const input = Array.isArray(data) ? data : [data]

    const options = await this.createOptions_(input, sharedContext)

    const createdOptions = await this.baseRepository_.serialize<
      ProductTypes.ProductOptionDTO[]
    >(options)

    return Array.isArray(data) ? createdOptions : createdOptions[0]
  }

  @InjectTransactionManager("baseRepository_")
  protected async createOptions_(
    data: ProductTypes.CreateProductOptionDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ProductOption[]> {
    if (data.some((v) => !v.product_id)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Tried to create options without specifying a product_id"
      )
    }

    const normalizedInput = data.map((opt) => {
      return {
        ...opt,
        values: opt.values?.map((v) => {
          return typeof v === "string" ? { value: v } : v
        }),
      }
    })

    return await this.productOptionService_.create(
      normalizedInput,
      sharedContext
    )
  }

  async upsertOptions(
    data: ProductTypes.UpsertProductOptionDTO[],
    sharedContext?: Context
  ): Promise<ProductTypes.ProductOptionDTO[]>
  async upsertOptions(
    data: ProductTypes.UpsertProductOptionDTO,
    sharedContext?: Context
  ): Promise<ProductTypes.ProductOptionDTO>

  @InjectTransactionManager("baseRepository_")
  async upsertOptions(
    data:
      | ProductTypes.UpsertProductOptionDTO[]
      | ProductTypes.UpsertProductOptionDTO,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ProductTypes.ProductOptionDTO[] | ProductTypes.ProductOptionDTO> {
    const input = Array.isArray(data) ? data : [data]
    const forUpdate = input.filter(
      (option): option is UpdateProductOptionInput => !!option.id
    )
    const forCreate = input.filter(
      (option): option is ProductTypes.CreateProductOptionDTO => !option.id
    )

    let created: ProductOption[] = []
    let updated: ProductOption[] = []

    if (forCreate.length) {
      created = await this.createOptions_(forCreate, sharedContext)
    }
    if (forUpdate.length) {
      updated = await this.updateOptions_(forUpdate, sharedContext)
    }

    const result = [...created, ...updated]
    const allOptions = await this.baseRepository_.serialize<
      ProductTypes.ProductOptionDTO[] | ProductTypes.ProductOptionDTO
    >(result)

    return Array.isArray(data) ? allOptions : allOptions[0]
  }

  updateOptions(
    id: string,
    data: ProductTypes.UpdateProductOptionDTO,
    sharedContext?: Context
  ): Promise<ProductTypes.ProductOptionDTO>
  updateOptions(
    selector: ProductTypes.FilterableProductOptionProps,
    data: ProductTypes.UpdateProductOptionDTO,
    sharedContext?: Context
  ): Promise<ProductTypes.ProductOptionDTO[]>

  @InjectManager("baseRepository_")
  async updateOptions(
    idOrSelector: string | ProductTypes.FilterableProductOptionProps,
    data: ProductTypes.UpdateProductOptionDTO,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ProductTypes.ProductOptionDTO[] | ProductTypes.ProductOptionDTO> {
    let normalizedInput: UpdateProductOptionInput[] = []
    if (isString(idOrSelector)) {
      await this.productOptionService_.retrieve(idOrSelector, {}, sharedContext)
      normalizedInput = [{ id: idOrSelector, ...data }]
    } else {
      const options = await this.productOptionService_.list(
        idOrSelector,
        {},
        sharedContext
      )

      normalizedInput = options.map((option) => ({
        id: option.id,
        ...data,
      }))
    }

    const options = await this.updateOptions_(normalizedInput, sharedContext)

    const updatedOptions = await this.baseRepository_.serialize<
      ProductTypes.ProductOptionDTO[]
    >(options)

    return isString(idOrSelector) ? updatedOptions[0] : updatedOptions
  }

  @InjectTransactionManager("baseRepository_")
  protected async updateOptions_(
    data: UpdateProductOptionInput[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ProductOption[]> {
    // Validation step
    const normalizedInput = data.map((opt) => {
      return {
        ...opt,
        ...(opt.values
          ? {
              values: opt.values.map((v) => {
                return typeof v === "string" ? { value: v } : v
              }),
            }
          : {}),
      } as UpdateProductOptionInput
    })

    if (normalizedInput.some((option) => !option.id)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Tried to update options without specifying an ID"
      )
    }

    return await this.productOptionService_.upsertWithReplace(
      normalizedInput,
      { relations: ["values"] },
      sharedContext
    )
  }

  createCollections(
    data: ProductTypes.CreateProductCollectionDTO[],
    sharedContext?: Context
  ): Promise<ProductTypes.ProductCollectionDTO[]>
  createCollections(
    data: ProductTypes.CreateProductCollectionDTO,
    sharedContext?: Context
  ): Promise<ProductTypes.ProductCollectionDTO>

  @InjectManager("baseRepository_")
  async createCollections(
    data:
      | ProductTypes.CreateProductCollectionDTO[]
      | ProductTypes.CreateProductCollectionDTO,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<
    ProductTypes.ProductCollectionDTO[] | ProductTypes.ProductCollectionDTO
  > {
    const input = Array.isArray(data) ? data : [data]

    const collections = await this.createCollections_(input, sharedContext)

    const createdCollections = await this.baseRepository_.serialize<
      ProductTypes.ProductCollectionDTO[]
    >(collections)

    await this.eventBusModuleService_?.emit<ProductCollectionEventData>(
      collections.map(({ id }) => ({
        eventName: ProductCollectionEvents.COLLECTION_CREATED,
        data: { id },
      }))
    )

    return Array.isArray(data) ? createdCollections : createdCollections[0]
  }

  @InjectTransactionManager("baseRepository_")
  async createCollections_(
    data: ProductTypes.CreateProductCollectionDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<TProductCollection[]> {
    const normalizedInput = data.map(
      ProductModuleService.normalizeCreateProductCollectionInput
    )

    return await this.productCollectionService_.upsertWithReplace(
      normalizedInput,
      { relations: ["products"] },
      sharedContext
    )
  }

  async upsertCollections(
    data: ProductTypes.UpsertProductCollectionDTO[],
    sharedContext?: Context
  ): Promise<ProductTypes.ProductCollectionDTO[]>
  async upsertCollections(
    data: ProductTypes.UpsertProductCollectionDTO,
    sharedContext?: Context
  ): Promise<ProductTypes.ProductCollectionDTO>
  @InjectTransactionManager("baseRepository_")
  async upsertCollections(
    data:
      | ProductTypes.UpsertProductCollectionDTO[]
      | ProductTypes.UpsertProductCollectionDTO,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<
    ProductTypes.ProductCollectionDTO[] | ProductTypes.ProductCollectionDTO
  > {
    const input = Array.isArray(data) ? data : [data]
    const forUpdate = input.filter(
      (collection): collection is UpdateCollectionInput => !!collection.id
    )
    const forCreate = input.filter(
      (collection): collection is ProductTypes.CreateProductCollectionDTO =>
        !collection.id
    )

    let created: ProductCollection[] = []
    let updated: ProductCollection[] = []

    if (forCreate.length) {
      created = await this.createCollections_(forCreate, sharedContext)
    }
    if (forUpdate.length) {
      updated = await this.updateCollections_(forUpdate, sharedContext)
    }

    const result = [...created, ...updated]
    const allCollections = await this.baseRepository_.serialize<
      ProductTypes.ProductCollectionDTO[] | ProductTypes.ProductCollectionDTO
    >(result)

    if (created.length) {
      await this.eventBusModuleService_?.emit<ProductCollectionEventData>(
        created.map(({ id }) => ({
          eventName: ProductCollectionEvents.COLLECTION_CREATED,
          data: { id },
        }))
      )
    }

    if (updated.length) {
      await this.eventBusModuleService_?.emit<ProductCollectionEventData>(
        updated.map(({ id }) => ({
          eventName: ProductCollectionEvents.COLLECTION_UPDATED,
          data: { id },
        }))
      )
    }

    return Array.isArray(data) ? allCollections : allCollections[0]
  }

  updateCollections(
    id: string,
    data: ProductTypes.UpdateProductCollectionDTO,
    sharedContext?: Context
  ): Promise<ProductTypes.ProductCollectionDTO>
  updateCollections(
    selector: ProductTypes.FilterableProductCollectionProps,
    data: ProductTypes.UpdateProductCollectionDTO,
    sharedContext?: Context
  ): Promise<ProductTypes.ProductCollectionDTO[]>

  @InjectManager("baseRepository_")
  async updateCollections(
    idOrSelector: string | ProductTypes.FilterableProductCollectionProps,
    data: ProductTypes.UpdateProductCollectionDTO,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<
    ProductTypes.ProductCollectionDTO[] | ProductTypes.ProductCollectionDTO
  > {
    let normalizedInput: UpdateCollectionInput[] = []
    if (isString(idOrSelector)) {
      await this.productCollectionService_.retrieve(
        idOrSelector,
        {},
        sharedContext
      )
      normalizedInput = [{ id: idOrSelector, ...data }]
    } else {
      const collections = await this.productCollectionService_.list(
        idOrSelector,
        {},
        sharedContext
      )

      normalizedInput = collections.map((collection) => ({
        id: collection.id,
        ...data,
      }))
    }

    const collections = await this.updateCollections_(
      normalizedInput,
      sharedContext
    )

    const updatedCollections = await this.baseRepository_.serialize<
      ProductTypes.ProductCollectionDTO[]
    >(collections)

    await this.eventBusModuleService_?.emit<ProductCollectionEventData>(
      updatedCollections.map(({ id }) => ({
        eventName: ProductCollectionEvents.COLLECTION_UPDATED,
        data: { id },
      }))
    )

    return isString(idOrSelector) ? updatedCollections[0] : updatedCollections
  }

  @InjectTransactionManager("baseRepository_")
  protected async updateCollections_(
    data: UpdateCollectionInput[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<TProductCollection[]> {
    const normalizedInput = data.map(
      ProductModuleService.normalizeUpdateProductCollectionInput
    )

    return await this.productCollectionService_.upsertWithReplace(
      normalizedInput,
      { relations: ["products"] },
      sharedContext
    )
  }

  @InjectTransactionManager("baseRepository_")
  async createCategory(
    data: ProductTypes.CreateProductCategoryDTO,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ProductTypes.ProductCategoryDTO> {
    const productCategory = await this.productCategoryService_.create(
      data,
      sharedContext
    )

    await this.eventBusModuleService_?.emit<ProductCategoryEventData>(
      ProductCategoryEvents.CATEGORY_CREATED,
      { id: productCategory.id }
    )

    return await this.baseRepository_.serialize(productCategory, {
      populate: true,
    })
  }

  @InjectTransactionManager("baseRepository_")
  async updateCategory(
    categoryId: string,
    data: ProductTypes.UpdateProductCategoryDTO,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ProductTypes.ProductCategoryDTO> {
    const productCategory = await this.productCategoryService_.update(
      categoryId,
      data,
      sharedContext
    )

    await this.eventBusModuleService_?.emit<ProductCategoryEventData>(
      ProductCategoryEvents.CATEGORY_UPDATED,
      { id: productCategory.id }
    )

    return await this.baseRepository_.serialize(productCategory, {
      populate: true,
    })
  }

  @InjectTransactionManager("baseRepository_")
  async deleteCategory(
    categoryId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    await this.productCategoryService_.delete(categoryId, sharedContext)

    await this.eventBusModuleService_?.emit<ProductCategoryEventData>(
      ProductCategoryEvents.CATEGORY_DELETED,
      { id: categoryId }
    )
  }

  create(
    data: ProductTypes.CreateProductDTO[],
    sharedContext?: Context
  ): Promise<ProductTypes.ProductDTO[]>
  create(
    data: ProductTypes.CreateProductDTO,
    sharedContext?: Context
  ): Promise<ProductTypes.ProductDTO>

  @InjectManager("baseRepository_")
  async create(
    data: ProductTypes.CreateProductDTO[] | ProductTypes.CreateProductDTO,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ProductTypes.ProductDTO[] | ProductTypes.ProductDTO> {
    const input = Array.isArray(data) ? data : [data]
    const products = await this.create_(input, sharedContext)

    const createdProducts = await this.baseRepository_.serialize<
      ProductTypes.ProductDTO[]
    >(products)

    await this.eventBusModuleService_?.emit<ProductEventData>(
      createdProducts.map(({ id }) => ({
        eventName: ProductEvents.PRODUCT_CREATED,
        data: { id },
      }))
    )

    return Array.isArray(data) ? createdProducts : createdProducts[0]
  }

  async upsert(
    data: ProductTypes.UpsertProductDTO[],
    sharedContext?: Context
  ): Promise<ProductTypes.ProductDTO[]>
  async upsert(
    data: ProductTypes.UpsertProductDTO,
    sharedContext?: Context
  ): Promise<ProductTypes.ProductDTO>
  @InjectTransactionManager("baseRepository_")
  async upsert(
    data: ProductTypes.UpsertProductDTO[] | ProductTypes.UpsertProductDTO,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ProductTypes.ProductDTO[] | ProductTypes.ProductDTO> {
    const input = Array.isArray(data) ? data : [data]
    const forUpdate = input.filter(
      (product): product is UpdateProductInput => !!product.id
    )
    const forCreate = input.filter(
      (product): product is ProductTypes.CreateProductDTO => !product.id
    )

    let created: Product[] = []
    let updated: Product[] = []

    if (forCreate.length) {
      created = await this.create_(forCreate, sharedContext)
    }
    if (forUpdate.length) {
      updated = await this.update_(forUpdate, sharedContext)
    }

    const result = [...created, ...updated]
    const allProducts = await this.baseRepository_.serialize<
      ProductTypes.ProductDTO[] | ProductTypes.ProductDTO
    >(result)

    if (created.length) {
      await this.eventBusModuleService_?.emit<ProductEventData>(
        created.map(({ id }) => ({
          eventName: ProductEvents.PRODUCT_CREATED,
          data: { id },
        }))
      )
    }

    if (updated.length) {
      await this.eventBusModuleService_?.emit<ProductEventData>(
        updated.map(({ id }) => ({
          eventName: ProductEvents.PRODUCT_UPDATED,
          data: { id },
        }))
      )
    }

    return Array.isArray(data) ? allProducts : allProducts[0]
  }

  update(
    id: string,
    data: ProductTypes.UpdateProductDTO,
    sharedContext?: Context
  ): Promise<ProductTypes.ProductDTO>
  update(
    selector: ProductTypes.FilterableProductProps,
    data: ProductTypes.UpdateProductDTO,
    sharedContext?: Context
  ): Promise<ProductTypes.ProductDTO[]>

  @InjectManager("baseRepository_")
  async update(
    idOrSelector: string | ProductTypes.FilterableProductProps,
    data: ProductTypes.UpdateProductDTO,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ProductTypes.ProductDTO[] | ProductTypes.ProductDTO> {
    let normalizedInput: UpdateProductInput[] = []
    if (isString(idOrSelector)) {
      // This will throw if the product does not exist
      await this.productService_.retrieve(idOrSelector, {}, sharedContext)

      normalizedInput = [{ id: idOrSelector, ...data }]
    } else {
      const products = await this.productService_.list(
        idOrSelector,
        {},
        sharedContext
      )

      normalizedInput = products.map((product) => ({
        id: product.id,
        ...data,
      }))
    }

    const products = await this.update_(normalizedInput, sharedContext)

    const updatedProducts = await this.baseRepository_.serialize<
      ProductTypes.ProductDTO[]
    >(products)

    await this.eventBusModuleService_?.emit<ProductEventData>(
      updatedProducts.map(({ id }) => ({
        eventName: ProductEvents.PRODUCT_UPDATED,
        data: { id },
      }))
    )

    return isString(idOrSelector) ? updatedProducts[0] : updatedProducts
  }

  @InjectTransactionManager("baseRepository_")
  protected async create_(
    data: ProductTypes.CreateProductDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<TProduct[]> {
    const normalizedInput = data.map(
      ProductModuleService.normalizeCreateProductInput
    )

    const productData = await this.productService_.upsertWithReplace(
      normalizedInput,
      {
        relations: ["images", "tags", "categories"],
      },
      sharedContext
    )

    await promiseAll(
      // Note: It's safe to rely on the order here as `upsertWithReplace` preserves the order of the input
      normalizedInput.map(async (product, i) => {
        const upsertedProduct: any = productData[i]
        upsertedProduct.options = []
        upsertedProduct.variants = []

        if (product.options?.length) {
          upsertedProduct.options =
            await this.productOptionService_.upsertWithReplace(
              product.options?.map((option) => ({
                ...option,
                product_id: upsertedProduct.id,
              })) ?? [],
              { relations: ["values"] },
              sharedContext
            )
        }

        if (product.variants?.length) {
          upsertedProduct.variants =
            await this.productVariantService_.upsertWithReplace(
              ProductModuleService.assignOptionsToVariants(
                product.variants?.map((v) => ({
                  ...v,
                  product_id: upsertedProduct.id,
                })) ?? [],
                upsertedProduct.options
              ),
              { relations: ["options"] },
              sharedContext
            )
        }
      })
    )

    return productData
  }

  @InjectTransactionManager("baseRepository_")
  protected async update_(
    data: UpdateProductInput[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<TProduct[]> {
    const normalizedInput = data.map(
      ProductModuleService.normalizeUpdateProductInput
    )

    const productData = await this.productService_.upsertWithReplace(
      normalizedInput,
      {
        relations: ["images", "tags", "categories"],
      },
      sharedContext
    )

    // There is more than 1-level depth of relations here, so we need to handle the options and variants manually
    await promiseAll(
      // Note: It's safe to rely on the order here as `upsertWithReplace` preserves the order of the input
      normalizedInput.map(async (product, i) => {
        const upsertedProduct: any = productData[i]
        let allOptions: any[] = []

        if (product.options?.length) {
          upsertedProduct.options =
            await this.productOptionService_.upsertWithReplace(
              product.options?.map((option) => ({
                ...option,
                product_id: upsertedProduct.id,
              })) ?? [],
              { relations: ["values"] },
              sharedContext
            )

          // Since we handle the options and variants outside of the product upsert, we need to clean up manuallys
          await this.productOptionService_.delete(
            {
              product_id: upsertedProduct.id,
              id: {
                $nin: upsertedProduct.options.map(({ id }) => id),
              },
            },
            sharedContext
          )
          allOptions = upsertedProduct.options
        } else {
          // If the options weren't affected, but the user is changing the variants, make sure we have all options available locally
          if (product.variants?.length) {
            allOptions = await this.productOptionService_.list(
              { product_id: upsertedProduct.id },
              { take: null },
              sharedContext
            )
          }
        }

        if (product.variants?.length) {
          upsertedProduct.variants =
            await this.productVariantService_.upsertWithReplace(
              ProductModuleService.assignOptionsToVariants(
                product.variants?.map((v) => ({
                  ...v,
                  product_id: upsertedProduct.id,
                })) ?? [],
                allOptions
              ),
              { relations: ["options"] },
              sharedContext
            )

          await this.productVariantService_.delete(
            {
              product_id: upsertedProduct.id,
              id: {
                $nin: upsertedProduct.variants.map(({ id }) => id),
              },
            },
            sharedContext
          )
        }
      })
    )

    return productData
  }

  protected static normalizeCreateProductInput(
    product: ProductTypes.CreateProductDTO
  ): ProductTypes.CreateProductDTO {
    const productData = ProductModuleService.normalizeUpdateProductInput(
      product as UpdateProductInput
    ) as ProductTypes.CreateProductDTO

    if (!productData.handle && productData.title) {
      productData.handle = kebabCase(productData.title)
    }

    if (!productData.status) {
      productData.status = ProductStatus.DRAFT
    }

    if (!productData.thumbnail && productData.images?.length) {
      productData.thumbnail = productData.images[0].url
    }

    return productData
  }

  protected static normalizeUpdateProductInput(
    product: UpdateProductInput
  ): UpdateProductInput {
    const productData = { ...product }
    if (productData.is_giftcard) {
      productData.discountable = false
    }

    if (productData.options?.length) {
      ;(productData as any).options = productData.options?.map((option) => {
        return {
          title: option.title,
          values: option.values?.map((value) => {
            return {
              value: value,
            }
          }),
        }
      })
    }

    return productData
  }

  protected static normalizeCreateProductCollectionInput(
    collection: ProductTypes.CreateProductCollectionDTO
  ): ProductTypes.CreateProductCollectionDTO {
    const collectionData =
      ProductModuleService.normalizeUpdateProductCollectionInput(
        collection
      ) as ProductTypes.CreateProductCollectionDTO

    if (!collectionData.handle && collectionData.title) {
      collectionData.handle = kebabCase(collectionData.title)
    }

    return collectionData
  }

  protected static normalizeUpdateProductCollectionInput(
    collection: ProductTypes.CreateProductCollectionDTO | UpdateCollectionInput
  ): ProductTypes.CreateProductCollectionDTO | UpdateCollectionInput {
    const collectionData = { ...collection }
    if (collectionData.product_ids?.length) {
      ;(collectionData as any).products = collectionData.product_ids.map(
        (pid) => ({
          id: pid,
        })
      )
      delete collectionData.product_ids
    }

    return collectionData
  }

  protected static assignOptionsToVariants(
    variants:
      | ProductTypes.CreateProductVariantDTO[]
      | ProductTypes.UpdateProductVariantDTO[],
    options: ProductOption[]
  ):
    | ProductTypes.CreateProductVariantDTO[]
    | ProductTypes.UpdateProductVariantDTO[] {
    if (!variants.length) {
      return variants
    }

    const variantsWithOptions = variants.map((variant: any) => {
      const variantOptions = Object.entries(variant.options ?? {}).map(
        ([key, val]) => {
          const option = options.find((o) => o.title === key)
          const optionValue = option?.values?.find(
            (v: any) => (v.value?.value ?? v.value) === val
          )

          if (!optionValue) {
            throw new MedusaError(
              MedusaError.Types.INVALID_DATA,
              `Option value ${val} does not exist for option ${key}`
            )
          }

          return {
            variant_id: variant.id,
            option_value_id: optionValue.id,
          }
        }
      )

      if (!variantOptions.length) {
        return variant
      }

      return {
        ...variant,
        options: variantOptions,
      }
    })

    return variantsWithOptions
  }
}
