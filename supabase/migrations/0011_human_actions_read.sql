ALTER TABLE human_actions DROP CONSTRAINT IF EXISTS human_actions_action_type_check;
ALTER TABLE human_actions ADD CONSTRAINT human_actions_action_type_check
  CHECK (action_type IN ('prune','flag','annotate','expand','reframe','generate','select','read'));
