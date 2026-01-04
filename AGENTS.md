# AGENTS

<skills_system priority="1">

## Available Skills

<!-- SKILLS_TABLE_START -->
<usage>
When users ask you to perform tasks, check if any of the available skills below can help complete the task more effectively. Skills provide specialized capabilities and domain knowledge.

How to use skills:
- Invoke: Bash("openskills read <skill-name>")
- The skill content will load with detailed instructions on how to complete the task
- Base directory provided in output for resolving bundled resources (references/, scripts/, assets/)

Usage notes:
- Only use skills listed in <available_skills> below
- Do not invoke a skill that is already loaded in your context
- Each skill invocation is stateless
</usage>

<available_skills>

<skill>
<name>disc-doc-writer</name>
<description>"Structured documentation of discussion details, writing decisions, solutions, and research into standardized documents"</description>
<location>global</location>
</skill>

<skill>
<name>disc-file-manager</name>
<description>"Manage discussion file creation and storage, maintain discuss/ directory structure"</description>
<location>global</location>
</skill>

<skill>
<name>disc-outline-renderer</name>
<description>"Render visual structure of discussion outlines, using tree symbols and box lines to improve readability"</description>
<location>global</location>
</skill>

<skill>
<name>disc-problem-tracker</name>
<description>"Manage complete lifecycle of problems, ensure each problem has clear resolution"</description>
<location>global</location>
</skill>

<skill>
<name>disc-trend-tracker</name>
<description>"Track problem count trends in discussions, detect convergence points, alleviate user anxiety about discussion duration"</description>
<location>global</location>
</skill>

</available_skills>
<!-- SKILLS_TABLE_END -->

</skills_system>
