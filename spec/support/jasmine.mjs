export default {
  spec_dir: "spec",
  spec_files: [
    "**/*[sS]pec.?(m|c)js"
  ],
  helpers: [
    "helpers/**/*.?(m|c)js"
  ],
  env: {
    stopSpecOnExpectationFailure: false,
    random: true,
    forbidDuplicateNames: true
  }
}
