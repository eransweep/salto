/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ElemID,
  InstanceElement,
  ObjectType,
  toChange,
  Change,
  CORE_ANNOTATIONS,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { getChangeGroupIds } from '../src/group_change'
import {
  FIELD_CONFIGURATION_ITEM_TYPE_NAME,
  FIELD_CONFIGURATION_TYPE_NAME,
  JIRA,
  SECURITY_LEVEL_TYPE,
  SECURITY_SCHEME_TYPE,
  SLA_TYPE_NAME,
  WORKFLOW_TYPE_NAME,
} from '../src/constants'
import { FIELD_CONTEXT_OPTION_TYPE_NAME, FIELD_CONTEXT_TYPE_NAME } from '../src/filters/fields/constants'
import { createEmptyType } from './utils'

describe('group change', () => {
  let workflowType: ObjectType
  let workflowInstance1: InstanceElement
  let workflowInstance2: InstanceElement
  let workflowInstance3: InstanceElement

  let securityLevelType: ObjectType
  let securityLevelInstance: InstanceElement
  let securitySchemeType: ObjectType
  let securitySchemeInstance: InstanceElement

  let fieldConfigurationType: ObjectType
  let fieldConfigurationItemType: ObjectType
  let fieldConfigurationItemInstance1: InstanceElement
  let fieldConfigurationItemInstance2: InstanceElement
  let fieldConfigurationItemInstance3: InstanceElement
  let fieldConfiguration1: InstanceElement
  let fieldConfiguration2: InstanceElement

  let fieldContextType: ObjectType
  let fieldContextOptionType: ObjectType
  let fieldContextOptionInstance1: InstanceElement
  let fieldContextOptionInstance2: InstanceElement
  let fieldContextOptionInstance3: InstanceElement
  let fieldContextInstance1: InstanceElement
  let fieldContextInstance2: InstanceElement

  beforeEach(() => {
    workflowType = new ObjectType({ elemID: new ElemID(JIRA, WORKFLOW_TYPE_NAME) })
    workflowInstance1 = new InstanceElement('workflow1', workflowType)
    workflowInstance2 = new InstanceElement('workflow2', workflowType)
    workflowInstance3 = new InstanceElement('workflow3', workflowType)

    securityLevelType = new ObjectType({ elemID: new ElemID(JIRA, SECURITY_LEVEL_TYPE) })
    securitySchemeType = new ObjectType({ elemID: new ElemID(JIRA, SECURITY_SCHEME_TYPE) })

    securitySchemeInstance = new InstanceElement('securityScheme', securitySchemeType)
    securityLevelInstance = new InstanceElement('securityLevel', securityLevelType, {}, undefined, {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(securitySchemeInstance.elemID, securitySchemeInstance)],
    })

    fieldConfigurationType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONFIGURATION_TYPE_NAME),
    })
    fieldConfigurationItemType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONFIGURATION_ITEM_TYPE_NAME),
    })

    fieldConfiguration1 = new InstanceElement('parent1', fieldConfigurationType)
    fieldConfiguration2 = new InstanceElement('parent2', fieldConfigurationType)

    fieldConfigurationItemInstance1 = new InstanceElement(
      'fieldConfigurationItemInstance1',
      fieldConfigurationItemType,
      {},
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(fieldConfiguration1.elemID, fieldConfiguration1)],
      },
    )

    fieldConfigurationItemInstance2 = new InstanceElement(
      'fieldConfigurationItemInstance2',
      fieldConfigurationItemType,
      {},
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(fieldConfiguration1.elemID, fieldConfiguration1)],
      },
    )

    fieldConfigurationItemInstance3 = new InstanceElement(
      'fieldConfigurationItemInstance3',
      fieldConfigurationItemType,
      {},
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(fieldConfiguration2.elemID, fieldConfiguration2)],
      },
    )

    fieldContextType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME),
    })
    fieldContextOptionType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONTEXT_OPTION_TYPE_NAME),
    })

    fieldContextInstance1 = new InstanceElement('parent1', fieldContextType)
    fieldContextInstance2 = new InstanceElement('parent2', fieldContextType)

    fieldContextOptionInstance1 = new InstanceElement(
      'fieldContextOptionInstance1',
      fieldContextOptionType,
      {},
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(fieldContextInstance1.elemID, fieldContextInstance1)],
      },
    )
    fieldContextOptionInstance2 = new InstanceElement(
      'fieldContextOptionInstance2',
      fieldContextOptionType,
      {},
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(fieldContextInstance1.elemID, fieldContextInstance1)],
      },
    )
    fieldContextOptionInstance3 = new InstanceElement(
      'fieldContextOptionInstance3',
      fieldContextOptionType,
      {},
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(fieldContextInstance2.elemID, fieldContextInstance2)],
      },
    )
  })

  it('should group workflow modifications', async () => {
    const changeGroupIds = (
      await getChangeGroupIds(
        new Map<string, Change>([
          [
            workflowInstance1.elemID.getFullName(),
            toChange({
              before: workflowInstance1,
              after: workflowInstance1,
            }),
          ],
          [
            workflowInstance2.elemID.getFullName(),
            toChange({
              before: workflowInstance2,
              after: workflowInstance2,
            }),
          ],
          [workflowInstance3.elemID.getFullName(), toChange({ after: workflowInstance3 })],
        ]),
      )
    ).changeGroupIdMap

    expect(changeGroupIds.get(workflowInstance1.elemID.getFullName())).toBe('Workflow Modifications')
    expect(changeGroupIds.get(workflowInstance2.elemID.getFullName())).toBe('Workflow Modifications')
    expect(changeGroupIds.get(workflowInstance3.elemID.getFullName())).toBe(workflowInstance3.elemID.getFullName())
  })

  it('should group security scheme levels', async () => {
    const changeGroupIds = (
      await getChangeGroupIds(
        new Map<string, Change>([
          [
            securityLevelInstance.elemID.getFullName(),
            toChange({
              after: securityLevelInstance,
            }),
          ],
          [
            securitySchemeInstance.elemID.getFullName(),
            toChange({
              after: securitySchemeInstance,
            }),
          ],
        ]),
      )
    ).changeGroupIdMap

    expect(changeGroupIds.get(securityLevelInstance.elemID.getFullName())).toBe(
      securitySchemeInstance.elemID.getFullName(),
    )

    expect(changeGroupIds.get(securitySchemeInstance.elemID.getFullName())).toBe(
      securitySchemeInstance.elemID.getFullName(),
    )
  })

  it('should throw if security scheme levels do not contain parent', async () => {
    delete securityLevelInstance.annotations[CORE_ANNOTATIONS.PARENT]

    await expect(
      getChangeGroupIds(
        new Map<string, Change>([
          [
            securityLevelInstance.elemID.getFullName(),
            toChange({
              after: securityLevelInstance,
            }),
          ],
          [
            securitySchemeInstance.elemID.getFullName(),
            toChange({
              after: securitySchemeInstance,
            }),
          ],
        ]),
      ),
    ).rejects.toThrow()
  })

  it('should group field configuration items', async () => {
    const changeGroupIds = (
      await getChangeGroupIds(
        new Map<string, Change>([
          [
            fieldConfigurationItemInstance1.elemID.getFullName(),
            toChange({
              after: fieldConfigurationItemInstance1,
            }),
          ],
          [
            fieldConfigurationItemInstance2.elemID.getFullName(),
            toChange({
              after: fieldConfigurationItemInstance2,
            }),
          ],
          [
            fieldConfigurationItemInstance3.elemID.getFullName(),
            toChange({
              after: fieldConfigurationItemInstance3,
            }),
          ],
        ]),
      )
    ).changeGroupIdMap

    expect(changeGroupIds.get(fieldConfigurationItemInstance1.elemID.getFullName())).toBe(
      `${fieldConfiguration1.elemID.getFullName()} items`,
    )

    expect(changeGroupIds.get(fieldConfigurationItemInstance2.elemID.getFullName())).toBe(
      `${fieldConfiguration1.elemID.getFullName()} items`,
    )

    expect(changeGroupIds.get(fieldConfigurationItemInstance3.elemID.getFullName())).toBe(
      `${fieldConfiguration2.elemID.getFullName()} items`,
    )
  })

  it('should throw if field configuration does not have parent', async () => {
    delete fieldConfigurationItemInstance1.annotations[CORE_ANNOTATIONS.PARENT]
    await expect(
      getChangeGroupIds(
        new Map<string, Change>([
          [
            fieldConfigurationItemInstance1.elemID.getFullName(),
            toChange({
              after: fieldConfigurationItemInstance1,
            }),
          ],
        ]),
      ),
    ).rejects.toThrow()
  })
  it('should group field context options', async () => {
    const changeGroupIds = (
      await getChangeGroupIds(
        new Map<string, Change>([
          [
            fieldContextOptionInstance1.elemID.getFullName(),
            toChange({
              after: fieldContextOptionInstance1,
            }),
          ],
          [
            fieldContextOptionInstance2.elemID.getFullName(),
            toChange({
              after: fieldContextOptionInstance2,
            }),
          ],
          [
            fieldContextOptionInstance3.elemID.getFullName(),
            toChange({
              after: fieldContextOptionInstance3,
            }),
          ],
        ]),
      )
    ).changeGroupIdMap

    expect(changeGroupIds.get(fieldContextOptionInstance1.elemID.getFullName())).toEqual(
      'jira.CustomFieldContext.instance.parent1',
    )
    expect(changeGroupIds.get(fieldContextOptionInstance2.elemID.getFullName())).toEqual(
      'jira.CustomFieldContext.instance.parent1',
    )
    expect(changeGroupIds.get(fieldContextOptionInstance3.elemID.getFullName())).toEqual(
      'jira.CustomFieldContext.instance.parent2',
    )
  })

  it('should throw if field context option does not have parent', async () => {
    delete fieldContextOptionInstance1.annotations[CORE_ANNOTATIONS.PARENT]
    await expect(
      getChangeGroupIds(
        new Map<string, Change>([
          [
            fieldContextOptionInstance1.elemID.getFullName(),
            toChange({
              after: fieldContextOptionInstance1,
            }),
          ],
        ]),
      ),
    ).rejects.toThrow()
  })
  it('should group addition of slas by project', async () => {
    const projectInstance = new InstanceElement('project1', createEmptyType('project'), { id: 1 })
    const slaInstance = new InstanceElement('sla1', createEmptyType(SLA_TYPE_NAME), { id: 11 }, undefined, {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance.elemID, projectInstance)],
    })
    const sla2Instance = new InstanceElement('sla2', createEmptyType(SLA_TYPE_NAME), { id: 12 }, undefined, {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance.elemID, projectInstance)],
    })
    const slaAdditionChange = toChange({ after: slaInstance })
    const slaAdditionChange2 = toChange({ after: sla2Instance })

    const changeGroupIds = (
      await getChangeGroupIds(
        new Map<string, Change>([
          [slaInstance.elemID.getFullName(), slaAdditionChange],
          [sla2Instance.elemID.getFullName(), slaAdditionChange2],
        ]),
      )
    ).changeGroupIdMap

    expect(changeGroupIds.get(slaInstance.elemID.getFullName())).toEqual(
      'sla addition of jira.project.instance.project1',
    )
  })
})
