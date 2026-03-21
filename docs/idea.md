This project is a cli tool that runs and tracks users tasks trough a workflow


- This tool is going to work as a workflow engine that an ai agent can use to systematically follow a user defined workflow. 
- The tool will inject a defined context for the agent for each step of the workflow so that the agen 100% gets the reguired context. 
- User can define multiple custom workflows called `flows` that can be used complete tasks
- User can start a task with given flow and the tool will track the tasks state and guide the user or agent on what step is next

Ideas of commands:

init: Initializes the project structure
validate: Validates that the project structure is correct
validate --flow *flow name*: validates that flow config is correct
next --task *task name*: Gives the next step info for the given task
next --task *task name* --paraller: Gives all the next steps infos that can be done paraller at this point
context --task *task name*: Gives the context for the given task
state --task *task name*: Gives the state of the current task
revise --task *task name* --step *step name*: Marks the steps state as needs revision
    - Also cascades the workflow chain to mark all affected steps to ready

Task structure:
1. .taskState.yaml
    - This file keeps the state of the task
    - State contains
        - flow name that is used
        - state of each step in given flow
            - state: ready | done | blocked | revision

Flow structure:
1. chainflow.yaml
    - The flow config that describes the flow
    - Has flow level fields
    - Has steps
        - Each step can have
            - name
            - description
            - required(optional): is required to be completed 
            - requires(optional): what steps needs to be completed before this
            - generates(optional): filename that this step needs to generate 
            - generateStrategy(options): update | replace | version
                - Wether to update or replace the existing file or to write new and verrsion the previous file
            - tasks(optional): step that generates a task list file to track
            - subagent(optional): If given indicates that this step needs to be ran in a subagent
                - if true use a generic subagent, if string search for agent with this name to run with
            - context
                - instructions: path for instructions file for this steps
                - references: list of paths to reference -> Will inject a prompt to instruct to reference these PATHS 
                - steps: list of steps to inject into context
            - validates: list of steps that this step validates 
                - injects a prompt that instructs to make a decision for each validation step wether it passes or fails
                - if a spesific step fails instructs to run a revise command for a step

Future things: 
- Skill to use for agent to give instructions about this cli
- Skill to create a flow to this tool
