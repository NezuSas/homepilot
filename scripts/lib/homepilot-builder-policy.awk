# Validate the policy reported by the running BuildKit daemon through buildx
# inspect. BuildKit rewrites buildkitd.toml, so comparing that file is unsafe.
function trim(value) {
  sub(/^[[:space:]]+/, "", value)
  sub(/[[:space:]]+$/, "", value)
  return value
}

function bytes(value, amount, unit) {
  value = trim(value)
  if (value !~ /^[0-9]+([.][0-9]+)?(B|KiB|MiB|GiB|TiB)$/) return -1
  amount = value + 0
  unit = value
  sub(/^[0-9]+([.][0-9]+)?/, "", unit)
  if (unit == "B") return amount
  if (unit == "KiB") return amount * 1024
  if (unit == "MiB") return amount * 1048576
  if (unit == "GiB") return amount * 1073741824
  return amount * 1099511627776
}

function valid_filters(value, items, seen, count, i) {
  count = split(value, items, ",")
  if (count != 3) return 0
  for (i = 1; i <= count; i++) {
    items[i] = trim(items[i])
    if (items[i] != "type==source.local" && items[i] != "type==exec.cachemount" && items[i] != "type==source.git.checkout") return 0
    if (seen[items[i]]++) return 0
  }
  return 1
}

function valid_rule(rule_index, prefix) {
  prefix = rule_index SUBSEP
  if (field[prefix "All"] != (rule_index == 3 ? "true" : "false")) return 0
  if (rule_index == 0) {
    return valid_filters(field[prefix "Filters"]) &&
      (field[prefix "Keep Duration"] == "48h0m0s" || field[prefix "Keep Duration"] == "48h") &&
      bytes(field[prefix "Max Used Space"]) == 1073741824 &&
      fields[rule_index] == 4
  }
  if (bytes(field[prefix "Reserved Space"]) != 8589934592 ||
      bytes(field[prefix "Max Used Space"]) != 11811160064 ||
      bytes(field[prefix "Min Free Space"]) != 26843545600) return 0
  if (rule_index == 1) {
    return (field[prefix "Keep Duration"] == "720h0m0s" || field[prefix "Keep Duration"] == "720h") && fields[rule_index] == 5
  }
  return fields[rule_index] == 4
}

{
  line = trim($0)
  if (line ~ /^Driver:[[:space:]]*/) {
    if (++drivers != 1 || line !~ /^Driver:[[:space:]]*docker-container$/) invalid = 1
  } else if (line ~ /^Driver Options:/) {
    if (++driver_options != 1 || line !~ /(^|[[:space:]])default-load="?true"?([[:space:]]|$)/) invalid = 1
  } else if (line ~ /^Status:/) {
    if (++statuses != 1 || line !~ /^Status:[[:space:]]*running$/) invalid = 1
  } else if (line ~ /^GC Policy rule#[0-9]+:/) {
    rule_index = line
    sub(/^GC Policy rule#/, "", rule_index)
    sub(/:.*/, "", rule_index)
    if (rule_index + 0 != rules + 0 || rules >= 4) invalid = 1
    rules++
    in_rule = 1
  } else if (in_rule && line != "" && line ~ /^[^:]+:[[:space:]]*/) {
    key = line
    sub(/:.*/, "", key)
    value = line
    sub(/^[^:]+:[[:space:]]*/, "", value)
    if (key != "All" && key != "Filters" && key != "Keep Duration" &&
        key != "Reserved Space" && key != "Max Used Space" && key != "Min Free Space") invalid = 1
    if (field[rule_index SUBSEP key] != "") invalid = 1
    field[rule_index SUBSEP key] = value
    fields[rule_index]++
  }
}

END {
  if (invalid || drivers != 1 || driver_options != 1 || statuses != 1 || rules != 4) exit 1
  for (i = 0; i < 4; i++) if (!valid_rule(i)) exit 1
}
