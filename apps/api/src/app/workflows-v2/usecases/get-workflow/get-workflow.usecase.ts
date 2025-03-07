import { Injectable } from '@nestjs/common';

import {
  ControlValuesEntity,
  ControlValuesRepository,
  NotificationStepEntity,
  NotificationTemplateRepository,
} from '@novu/dal';
import { ControlVariablesLevelEnum } from '@novu/shared';
import { GetPreferences, GetPreferencesCommand } from '@novu/application-generic';

import { GetWorkflowCommand } from './get-workflow.command';
import { WorkflowNotFoundException } from '../../exceptions/workflow-not-found-exception';
import { WorkflowResponseDto } from '../../dto/workflow-response-dto';
import { toResponseWorkflowDto } from '../../mappers/notification-template-mapper';

@Injectable()
export class GetWorkflowUseCase {
  constructor(
    private notificationTemplateRepository: NotificationTemplateRepository,
    private controlValuesRepository: ControlValuesRepository,
    private getPreferencesUseCase: GetPreferences
  ) {}
  async execute(command: GetWorkflowCommand): Promise<WorkflowResponseDto> {
    const notificationTemplateEntity = await this.notificationTemplateRepository.findByIdQuery({
      id: command._workflowId,
      environmentId: command.user.environmentId,
    });

    if (!notificationTemplateEntity) {
      throw new WorkflowNotFoundException(command._workflowId);
    }
    const stepIdToControlValuesMap = await this.getControlsValuesMap(notificationTemplateEntity.steps, command);
    const preferences = await this.getPreferencesUseCase.safeExecute(
      GetPreferencesCommand.create({
        environmentId: command.user.environmentId,
        organizationId: command.user.organizationId,
      })
    );

    return toResponseWorkflowDto(notificationTemplateEntity, preferences, stepIdToControlValuesMap);
  }

  private async getControlsValuesMap(
    steps: NotificationStepEntity[],
    command: GetWorkflowCommand
  ): Promise<{ [key: string]: ControlValuesEntity }> {
    const acc: { [key: string]: ControlValuesEntity } = {};

    for (const step of steps) {
      const controlValuesEntity = await this.buildControlValuesForStep(step, command);
      if (controlValuesEntity) {
        acc[step._templateId] = controlValuesEntity;
      }
    }

    return acc;
  }
  private async buildControlValuesForStep(
    step: NotificationStepEntity,
    command: GetWorkflowCommand
  ): Promise<ControlValuesEntity | null> {
    return await this.controlValuesRepository.findFirst({
      _environmentId: command.user.environmentId,
      _organizationId: command.user.organizationId,
      _workflowId: command._workflowId,
      _stepId: step._templateId,
      level: ControlVariablesLevelEnum.STEP_CONTROLS,
    });
  }
}
