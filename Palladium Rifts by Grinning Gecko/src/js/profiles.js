async function updateProfile(rowId) {
  const bonusIds = (
    await getAttrsAsync(["repeating_profiles_bonus_ids"])
  ).repeating_profiles_bonus_ids.split(",");
  console.log(bonusIds);
  const bonusNameKeys = bonusIds.map((id) => `repeating_bonuses_${id}_name`);
  const a = await getAttrsAsync(bonusNameKeys);
  const names = Object.values(a).reduce(
    // using Em Space https://www.compart.com/en/unicode/U+2003
    (acc, cur) => `${acc}     ✔︎${cur}`.trim(),
    ""
  );
  await setAttrsAsync({
    [`repeating_profiles_${rowId}_bonus_names`]: names,
    [`repeating_profiles_${rowId}_rowid`]: `repeating_profiles_${rowId}_`,
  });
  await combineBonuses(bonusIds, `repeating_profiles_${rowId}`);
}

async function setSingleAttributeFromDefaultProfile(attrName, profileAttrName) {
  const profileMeta = await getAttrsAsync(["default_profile"]);
  const repeatingAttribute = `repeating_profiles_${profileMeta["default_profile"]}_${profileAttrName}`;
  const a = await getAttrsAsync([repeatingAttribute]);
  await setAttrsAsync({ [attrName]: +a[repeatingAttribute] });
}

/**
 * Whether or not the current row is set as default
 * @param {string} rowId The Profile row ID
 * @returns boolean
 */
async function isDefault(section, rowId, attrName = "is_default") {
  const rowKey = `repeating_${section}_${rowId}_${attrName}`;
  const a = await getAttrsAsync([rowKey]);
  return a[rowKey] == "1";
}

async function setDefaultRepeatingRowAndUnsetOthers(
  section,
  rowId,
  attrName = "is_default",
  attrCurrent = "default_profile"
) {
  console.log("setDefaultRepeatingRowAndUnsetOthers", section, rowId, attrName);
  const rowIds = await getSectionIDsAsync(section);
  const isDefaultKeys = rowIds.map(
    (id) => `repeating_${section}_${id}_${attrName}`
  );
  const a = await getAttrsAsync(isDefaultKeys);
  const attrs = Object.entries(a).reduce((acc, [key, value]) => {
    acc[key] = "0";
    return acc;
  }, {});
  attrs[`repeating_${section}_${rowId}_${attrName}`] = "1";
  attrs[attrCurrent] = rowId;
  await setAttrsAsync(attrs);
}

/**
 * Sets the default row
 *  - Only row
 *  - A row that was set as default was deleted
 * @param {string} section Repeating section name.
 * @param {string} rowId Row ID that triggered this function. If a valid string, this
 *    row is set as default.
 * @param {string} attrName Attribute name to look for if different than "is_default".
 * @param {string} attrCurrent The attribute that holds the value of the current default row.
 */
async function setDefaultRepeatingRow(
  section,
  rowId,
  attrName = "is_default",
  attrCurrent = "default_profile"
) {
  if (rowId) {
    await setDefaultRepeatingRowAndUnsetOthers(
      section,
      rowId,
      attrName,
      attrCurrent
    );
    return;
  }

  const rowIds = await getSectionIDsOrderedAsync(section);
  const firstRow = `repeating_${section}_${rowIds[0]}_${attrName}`;

  const attrs = {};
  attrs[firstRow] = "1";
  attrs[attrCurrent] = rowIds[0];

  if (rowIds.length < 1) {
    await setAttrsAsync({ [attrCurrent]: "" });
    return;
  }

  if (rowIds.length === 1) {
    await setAttrsAsync(attrs);
    return;
  }

  // Was something deleted? If there's no current default, set the top item.
  const isDefaultKeys = rowIds.map(
    (id) => `repeating_${section}_${id}_${attrName}`
  );
  const a = await getAttrsAsync(isDefaultKeys);
  const isDefaultSet = Object.values(a).some((value) => +value == 1);
  if (!isDefaultSet) {
    await setAttrsAsync(attrs);
  }
}

on("change:default_profile", async (e) => {
  console.log("change:default_profile", e);
  if (e.newValue == "") {
    return;
  }
  const prefix = `repeating_profiles_${e.newValue}`;
  const a = await getAttrsAsync([`${prefix}_mdc`]);
  await setAttrsAsync({ default_mdc: a[`${prefix}_mdc`] });
  await updateSkills();
});

on("change:repeating_profiles:is_default", async (e) => {
  console.log("clicked:repeating_profiles:is_default", e);
  if (e.newValue != "1") {
    if (e.sourceType == "player") {
      // check it - don't allow unchecking
      await setAttrsAsync({ [e.sourceAttribute]: "1" });
    }
    return;
  }
  const [r, section, rowId, ...attrNameArray] = e.sourceAttribute.split("_");
  const attrName = attrNameArray.join("_");
  await setDefaultRepeatingRow(section, rowId, attrName, "default_profile");
});

on("clicked:repeating_profiles:copybonusids", async (e) => {
  console.log("clicked:copybonusids", e);
  const a = await getAttrsAsync(["bonus_ids_output"]);
  const attrs = {};
  attrs[`repeating_profiles_bonus_ids`] = a.bonus_ids_output;
  await setAttrsAsync(attrs);
});

on("clicked:repeating_profiles:checkbonusids", async (e) => {
  console.log("clicked:repeating_profiles:checkbonusids", e);
  const a = await getAttrsAsync(["repeating_profiles_bonus_ids"]);
  console.log(a);
  const bonusIds = a["repeating_profiles_bonus_ids"].split(",");
  const bonusselectionsSectionIds = await getSectionIDsAsync("bonusselections");
  const bonusIdKeys = bonusselectionsSectionIds.map(
    (id) => `repeating_bonusselections_${id}_bonus_id`
  );
  const allBonusselectionsIds = await getAttrsAsync(bonusIdKeys);
  console.log(allBonusselectionsIds);
  const attrs = {};
  for (const [key, val] of Object.entries(allBonusselectionsIds)) {
    const [r, section, rowId] = key.split("_");
    attrs[`repeating_bonusselections_${rowId}_enabled`] = bonusIds.includes(val)
      ? "1"
      : "0";
  }
  await setAttrsAsync(attrs);
});

on(
  "clicked:repeating_profiles:updateprofile \
  change:repeating_profiles:bonus_ids",
  async (e) => {
    console.log("clicked:repeating_profiles:updateprofile", e);
    const [r, section, rowId] = e.sourceAttribute.split("_");
    await updateProfile(rowId);
  }
);

on("change:repeating_profiles", async (e) => {
  console.log("change:repeating_profiles", e);
  const [r, section, rowId] = e.sourceAttribute.split("_");
  const a = await getAttrsAsync(["psionic_ability"]);
  const attrs = {};
  attrs[`repeating_${section}_${rowId}_global_psionic_ability`] =
    a["psionic_ability"];
  await setAttrsAsync(attrs);
});

on("change:_reporder:profiles", async (e) => {
  console.log("change:_reporder:profiles", e);
});

on("change:repeating_profiles:mod_skillbonus", async (e) => {
  console.log("change:repeating_profiles:mod_skillbonus", e);
  const [r, section, rowId] = e.sourceAttribute.split("_");
  if (await isDefault(section, rowId)) {
    await updateSkills();
  }
});

on("remove:repeating_profiles", async (e) => {
  console.log("remove:repeating_profiles", e);
  await setDefaultRepeatingRow("profiles");
});

on("clicked:getdefaultprofile", async (e) => {
  console.log("clicked:getdefaultprofile", e);
  const a = await getAttrsAsync(["default_profile", "default_mdc"]);
  console.log(a);
});

/**
 * Add a token {attack} times to the Turn Tracker in order against other tokens.
 * Requires API script access.
 * For use on an action button.
 *
 * [[d20+@{selected|repeating_profiles_-MibcwHG5hZXUJn6A7OG_initiative} &{tracker}]]
 */
async function palladiumAddToTurnTracker(e) {
  const [r, section, rowId] = e.sourceAttribute.split("_");
  const rowPrefix = `${r}_${section}_${rowId}`;
  const {
    [`${rowPrefix}_initiative`]: init,
    [`${rowPrefix}_attacks`]: attacks,
  } = await getAttrsAsync([`${rowPrefix}_initiative`, `${rowPrefix}_attacks`]);
  const roll = await startRoll(
    `&{template:test} {{name=Test}} {{roll1=[[1d20]]}}`
  );
  console.log(roll);
  const computed = roll.results.roll1.result + init;
  console.log(computed);
  finishRoll(roll.rollId, {
    roll1: computed,
  });
  const addToTracker = await startRoll(`[[[[${computed}]] &{tracker}]]`);
  finishRoll(addToTracker.rollId);
  // https://app.roll20.net/forum/post/6817409/multiple-initiative-values-for-a-single-character/?pageforid=6817748#post-6817748
  const dupeTracker = await startRoll(`!dup-turn ${attacks}`);
  finishRoll(dupeTracker.rollId);
}
