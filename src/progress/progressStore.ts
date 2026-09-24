import type {
  ApprovalSummary,
  CommandStatus,
  ProgressArtifact,
  ProgressCommand,
  ProgressFile,
  ProgressRun,
  ProgressTask,
  ProgressWorkflow,
  RunStatus,
  TaskStatus,
} from './types.js';

/**
 * A small mutable builder for a {@link ProgressRun} (Phase 20E, Task A).
 * Workflows declare a plan up front, then mark tasks/commands as they run. The
 * resulting run is rendered by `formatProgress` (text) or the Ink board.
 */
export class ProgressStore {
  private readonly run: ProgressRun;

  constructor(workflow: ProgressWorkflow, title: string, options: {projectPath?: string; providerModel?: string} = {}) {
    this.run = {
      workflow,
      title,
      status: 'running',
      projectPath: options.projectPath,
      providerModel: options.providerModel,
      tasks: [],
      files: [],
      commands: [],
      approvals: [],
      artifacts: [],
    };
  }

  /** Declare the plan (all tasks start pending). */
  planTasks(tasks: Array<{id: string; title: string}>): this {
    for (const task of tasks) this.run.tasks.push({id: task.id, title: task.title, status: 'pending'});
    return this;
  }

  setTask(id: string, status: TaskStatus, detail?: string): this {
    const task = this.run.tasks.find((t) => t.id === id);
    if (task) {
      task.status = status;
      if (detail !== undefined) task.detail = detail;
    }
    return this;
  }

  addTask(task: ProgressTask): this {
    this.run.tasks.push(task);
    return this;
  }

  addFile(file: ProgressFile): this {
    this.run.files.push(file);
    return this;
  }

  addFiles(files: ProgressFile[]): this {
    this.run.files.push(...files);
    return this;
  }

  addCommand(command: ProgressCommand): this {
    this.run.commands.push(command);
    return this;
  }

  setCommandStatus(command: string, status: CommandStatus, patch: Partial<ProgressCommand> = {}): this {
    const entry = this.run.commands.find((c) => c.command === command);
    if (entry) Object.assign(entry, {status}, patch);
    return this;
  }

  addApproval(approval: ApprovalSummary): this {
    this.run.approvals.push(approval);
    return this;
  }

  addArtifact(artifact: ProgressArtifact): this {
    if (artifact.path) this.run.artifacts.push(artifact);
    return this;
  }

  setStatus(status: RunStatus): this {
    this.run.status = status;
    return this;
  }

  /**
   * Derive the overall run status from task results: failed if any failed,
   * partial if some skipped after others passed, passed if all passed/skipped.
   */
  finalize(): ProgressRun {
    const tasks = this.run.tasks;
    if (tasks.some((t) => t.status === 'failed')) this.run.status = 'failed';
    else if (tasks.length > 0 && tasks.every((t) => t.status === 'skipped')) this.run.status = 'skipped';
    else if (tasks.some((t) => t.status === 'skipped')) this.run.status = 'partial';
    else this.run.status = 'passed';
    return this.run;
  }

  snapshot(): ProgressRun {
    return this.run;
  }
}
