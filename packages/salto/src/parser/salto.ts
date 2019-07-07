import * as _ from 'lodash'

import {
  ElementsRegistry, Type, ElemID, ObjectType, PrimitiveType, PrimitiveTypes,
  isObjectType, isPrimitiveType, Element,
} from 'adapter-api'
import HCLParser from './hcl'

enum Keywords {
  MODEL = 'model',
  TYPE_DEFINITION = 'type',
  TYPE_INHERITENCE_SEPARATOR = 'is',

  // Primitive types
  TYPE_STRING = 'string',
  TYPE_NUMBER = 'number',
  TYPE_BOOL = 'boolean',
  TYPE_OBJECT = 'object',
}

/**
 * @param typeName Type name in HCL syntax
 * @returns Primitive type identifier
 */
const getPrimitiveType = (typeName: string): PrimitiveTypes => {
  if (typeName === Keywords.TYPE_STRING) {
    return PrimitiveTypes.STRING
  }
  if (typeName === Keywords.TYPE_NUMBER) {
    return PrimitiveTypes.NUMBER
  }
  return PrimitiveTypes.BOOLEAN
}

/**
 * @param primitiveType Primitive type identifier
 * @returns Type name in HCL syntax
 */
const getPrimitiveTypeName = (primitiveType: PrimitiveTypes): string => {
  if (primitiveType === PrimitiveTypes.STRING) {
    return Keywords.TYPE_STRING
  }
  if (primitiveType === PrimitiveTypes.NUMBER) {
    return Keywords.TYPE_NUMBER
  }
  if (primitiveType === PrimitiveTypes.BOOLEAN) {
    return Keywords.TYPE_BOOL
  }
  return Keywords.TYPE_OBJECT
}

export default class Parser {
  private static getElemID(fullname: string): ElemID {
    const separatorIdx = fullname.indexOf(ElemID.NAMESPACE_SEPERATOR)
    const adapter = (separatorIdx >= 0) ? fullname.slice(0, separatorIdx) : undefined
    const name = fullname.slice(separatorIdx + ElemID.NAMESPACE_SEPERATOR.length)
    return new ElemID({ adapter, name })
  }

  private types: ElementsRegistry

  public constructor(types: ElementsRegistry) {
    this.types = new ElementsRegistry()
    this.types = this.types.merge(types)
  }

  private parseType(typeBlock: HCLBlock): Type {
    const [typeName] = typeBlock.labels
    const typeObj = this.types.getElement(Parser.getElemID(typeName)) as ObjectType

    Object.entries(typeBlock.attrs).forEach(([attrName, attrValue]) => {
      typeObj.annotationsValues[attrName] = attrValue
    })

    typeBlock.blocks.forEach(block => {
      if (block.labels.length === 1) {
        // Field block
        const fieldName = block.labels[0]
        typeObj.fields[fieldName] = this.types.getElement(Parser.getElemID(block.type))
        typeObj.annotationsValues[fieldName] = block.attrs
      } else {
        // This is something else, lets assume it is field overrides for now and we can extend
        // this later as we support more parts of the language
        typeObj.annotationsValues[block.type] = block.attrs
      }
    })

    return typeObj
  }

  private parsePrimitiveType(typeBlock: HCLBlock): Type {
    const [typeName, kw, baseType] = typeBlock.labels
    if (kw !== Keywords.TYPE_INHERITENCE_SEPARATOR) {
      throw new Error(`expected keyword ${Keywords.TYPE_INHERITENCE_SEPARATOR}. found ${kw}`)
    }

    if (baseType === Keywords.TYPE_OBJECT) {
      // Object types can have fields
      return this.parseType(typeBlock)
    }
    const typeObj = this.types.getElement(
      Parser.getElemID(typeName), getPrimitiveType(baseType),
    ) as PrimitiveType
    typeObj.annotationsValues = typeBlock.attrs
    return typeObj
  }

  /**
   * Parse a blueprint
   *
   * @param blueprint A buffer the contains the blueprint to parse
   * @param filename The name of the file from which the blueprint was read
   * @returns elements: Type elements found in the blueprint
   *          errors: Errors encountered during parsing
   */
  public async parse(blueprint: Buffer, filename: string):
    Promise<{ elements: Element[]; errors: string[] }> {
    const { body, errors } = await HCLParser.parse(blueprint, filename)

    body.blocks.forEach((value: HCLBlock): Type => {
      let elem: Type
      if (value.type === Keywords.MODEL) {
        elem = this.parseType(value)
        // TODO: we probably need to mark that elem is a model type so the adapter
        // will know it should create a new table for it
      } else if (value.type === Keywords.TYPE_DEFINITION) {
        elem = this.parsePrimitiveType(value)
      } else {
        // Without this exception the linter won't allow us to return elem
        // since it might be uninitialized
        throw new Error('unsupported block')
      }
      return elem
    })

    return { elements: this.types.getAllElements(), errors }
  }

  /**
   * Serialize elements to blueprint
   *
   * @param elements The elements to serialize
   * @returns A buffer with the elements serialized as a blueprint
   */
  public static dump(elements: Type[]): Promise<Buffer> {
    const blocks = elements.map(elem => {
      let block: HCLBlock
      if (isObjectType(elem)) {
        // Clone the annotation values because we may delete some keys from there
        const annotationValues = _.cloneDeep(elem.annotationsValues)
        block = {
          type: Keywords.MODEL,
          labels: [elem.elemID.getFullName()],
          attrs: annotationValues,
          blocks: Object.entries(elem.fields).map(([fieldName, fieldType]: [string, Type]) => {
            const fieldBlock: HCLBlock = {
              type: fieldType.elemID.getFullName(),
              labels: [fieldName],
              attrs: elem.annotationsValues[fieldName] || {},
              blocks: [],
            }
            // Remove the field annotations from the element annotations so they do not get
            // serialized twice
            delete annotationValues[fieldName]
            return fieldBlock
          }),
        }
      } else if (isPrimitiveType(elem)) {
        block = {
          type: Keywords.TYPE_DEFINITION,
          labels: [
            elem.elemID.getFullName(),
            Keywords.TYPE_INHERITENCE_SEPARATOR,
            getPrimitiveTypeName(elem.primitive),
          ],
          attrs: elem.annotationsValues,
          blocks: [],
        }
      } else {
        // Without this exception the linter won't allow us to return "block"
        // since it might be uninitialized
        throw new Error('unsupported type')
      }
      return block
    })

    const body: HCLBlock = {
      type: '',
      labels: [],
      attrs: {},
      blocks,
    }

    return HCLParser.dump(body)
  }
}
