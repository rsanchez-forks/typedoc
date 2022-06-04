// If updating these lists, also see .config/typedoc-default.tsdoc.json

export const tsdocBlockTags = [
    "@deprecated",
    "@param",
    "@remarks",
    "@throws",
    "@privateRemarks",
    "@defaultValue",
] as const;

export const blockTags = [
    ...tsdocBlockTags,
    "@module",
    "@inheritDoc",
    "@group",
    "@category",
] as const;

export const tsdocInlineTags = ["@link", "@inheritDoc", "@label"] as const;
export const inlineTags = tsdocInlineTags;

export const tsdocModifierTags = [
    "@public",
    "@private",
    "@protected",
    "@internal",
    "@readonly",
    "@packageDocumentation",
    "@eventProperty",
    "@alpha",
    "@beta",
    "@sealed",
    "@override",
    "@virtual",
] as const;

export const modifierTags = [
    ...tsdocModifierTags,
    "@hidden",
    "@ignore",
    "@enum",
    "@event",
] as const;
