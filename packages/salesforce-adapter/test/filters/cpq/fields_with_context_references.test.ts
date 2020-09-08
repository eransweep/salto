/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import { ObjectType, ElemID, Element, InstanceElement, isObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { FilterWith } from '../../../src/filter'
import SalesforceClient from '../../../src/client/client'
import { SALESFORCE, CPQ_PRODUCT_RULE, CPQ_LOOKUP_OBJECT_NAME, API_NAME, METADATA_TYPE, CUSTOM_OBJECT, CPQ_LOOKUP_QUERY, CPQ_LOOKUP_PRODUCT_FIELD, CPQ_LOOKUP_FIELD, CPQ_LOOKUP_MESSAGE_FIELD } from '../../../src/constants'
import { Types } from '../../../src/transformers/transformer'
import filterCreator from '../../../src/filters/cpq/fields_with_context_references'
import mockAdapter from '../../adapter'

describe('fields with context references filter', () => {
  let client: SalesforceClient
  type FilterType = FilterWith<'onFetch'>
  let filter: FilterType
  let elements: Element[]

  const lookupDataName = 'lookupData'

  const mockLookupDataElemID = new ElemID(SALESFORCE, lookupDataName)
  const mockLookupDataObject = new ObjectType({
    elemID: mockLookupDataElemID,
    fields: {
      product: {
        type: Types.primitiveDataTypes.Text,
        annotations: {
          [API_NAME]: 'product',
        },
      },
      message: {
        type: Types.primitiveDataTypes.Text,
        annotations: {
          [API_NAME]: 'message',
        },
      },
    },
    annotations: {
      [API_NAME]: lookupDataName,
      [METADATA_TYPE]: CUSTOM_OBJECT,
    },
  })

  const mockProductRuleElemID = new ElemID(SALESFORCE, CPQ_PRODUCT_RULE)
  const mockProductRuleObject = new ObjectType({
    elemID: mockProductRuleElemID,
    fields: {
      [CPQ_LOOKUP_OBJECT_NAME]: {
        type: Types.primitiveDataTypes.Text,
        annotations: {
          [API_NAME]: CPQ_LOOKUP_OBJECT_NAME,
        },
      },
      [CPQ_LOOKUP_PRODUCT_FIELD]: {
        type: Types.primitiveDataTypes.Text,
        annotations: {
          [API_NAME]: CPQ_LOOKUP_PRODUCT_FIELD,
        },
      },
      [CPQ_LOOKUP_MESSAGE_FIELD]: {
        type: Types.primitiveDataTypes.Text,
        annotations: {
          [API_NAME]: CPQ_LOOKUP_MESSAGE_FIELD,
        },
      },
    },
    annotations: {
      [API_NAME]: CPQ_PRODUCT_RULE,
      [METADATA_TYPE]: CUSTOM_OBJECT,
    },
  })

  const mockLookupQueryElemID = new ElemID(SALESFORCE, CPQ_LOOKUP_QUERY)
  const mockLookupQueryObject = new ObjectType({
    elemID: mockLookupQueryElemID,
    fields: {
      [CPQ_LOOKUP_FIELD]: {
        type: Types.primitiveDataTypes.Text,
        annotations: {
          [API_NAME]: CPQ_LOOKUP_FIELD,
        },
      },
      anotherField: {
        type: Types.primitiveDataTypes.Text,
        annotations: {
          [API_NAME]: 'anotherField',
        },
      },
    },
    annotations: {
      [API_NAME]: CPQ_LOOKUP_QUERY,
      [METADATA_TYPE]: CUSTOM_OBJECT,
    },
  })

  const productRuleValues = {
    [CPQ_LOOKUP_OBJECT_NAME]: lookupDataName,
    [CPQ_LOOKUP_PRODUCT_FIELD]: 'not a real product',
    [CPQ_LOOKUP_MESSAGE_FIELD]: 'message',
  }
  const productRuleInstance = new InstanceElement(
    'productRuleInst',
    mockProductRuleObject,
    productRuleValues
  )
  const productRuleWithBadLookupObjInstance = new InstanceElement(
    'productRuleBadLookupInst',
    mockProductRuleObject,
    {
      [CPQ_LOOKUP_OBJECT_NAME]: 'NotARealObject',
      [CPQ_LOOKUP_PRODUCT_FIELD]: 'product',
      [CPQ_LOOKUP_MESSAGE_FIELD]: 'message',
    }
  )

  const getCloneOfAllObjects = (): ObjectType[] =>
    [mockLookupQueryObject.clone(), mockProductRuleObject.clone(), mockLookupDataObject.clone()]

  describe('When all context objects exist in elements', () => {
    beforeAll(async () => {
      ({ client } = mockAdapter({
        adapterParams: {
        },
      }))
      filter = filterCreator({ client, config: {} }) as FilterType
      elements = [
        ...getCloneOfAllObjects(),
        productRuleWithBadLookupObjInstance.clone(),
        productRuleInstance.clone(),
      ]
      await filter.onFetch(elements)
    })

    it('Should not change the ObjectTypes', () => {
      const objectTypes = elements.filter(isObjectType)
      expect(objectTypes).toHaveLength(3)
      const lookupObj = objectTypes.find(ot => ot.elemID.isEqual(mockLookupQueryElemID))
      expect(lookupObj).toBeDefined()
      expect(lookupObj).toStrictEqual(mockLookupQueryObject)
      const productRule = objectTypes.find(ot => ot.elemID.isEqual(mockProductRuleElemID))
      expect(productRule).toBeDefined()
      expect(productRule).toStrictEqual(mockProductRuleObject)
      const lookupData = objectTypes.find(ot => ot.elemID.isEqual(mockLookupDataElemID))
      expect(lookupData).toBeDefined()
      expect(lookupData).toStrictEqual(mockLookupDataObject)
    })

    describe('When product rule (field context based) uses lookup object that does not exist', () => {
      it('Should not change any values', () => {
        const badLookupInst = elements
          .find(element => element.elemID.isEqual(productRuleWithBadLookupObjInstance.elemID))
        expect(badLookupInst).toBeDefined()
        expect(badLookupInst).toStrictEqual(productRuleWithBadLookupObjInstance)
      })
    })

    describe('When product rule (field context based) uses good lookup object', () => {
      let productRule: InstanceElement
      beforeAll(() => {
        productRule = elements
          .find(element => element.elemID.isEqual(productRuleInstance.elemID)) as InstanceElement
      })

      it('Should not change value if field name does not exist in lookup object', () => {
        expect(productRule).toBeDefined()
        expect(productRule.value.SBQQ__LookupProductField__c)
          .toEqual(productRuleValues.SBQQ__LookupProductField__c)
      })
      it('Should replace value of field that exists in lookup object with reference', () => {
        expect(productRule.value.SBQQ__LookupMessageField__c)
          .toEqual(new ReferenceExpression(mockLookupDataObject.fields.message.elemID))
      })
    })
  })
})
