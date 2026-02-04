import { Logger } from "tslog";

export const logger = new Logger({
  type: "pretty",
  stylePrettyLogs: true,
  prettyLogTemplate:
    "{{yyyy}}.{{mm}}.{{dd}} {{hh}}:{{mm}}:{{ss}} {{logLevelName}} ",
});
