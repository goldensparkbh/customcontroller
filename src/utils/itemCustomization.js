const PART_DISPLAY_ORDER = ['shell', 'trimpiece', 'touchpad', 'allButtons', 'sticks', 'bumpersTriggers', 'psButton', 'backShellMain'];
const PART_LABELS = {
  shell: 'Shell',
  trimpiece: 'Trim Piece',
  touchpad: 'Touchpad',
  allButtons: 'Buttons',
  sticks: 'Sticks',
  bumpersTriggers: 'Bumpers & Triggers',
  psButton: 'PS Button',
  backShellMain: 'Back Shell'
};

export const humanizeKey = (value) => String(value || '')
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/\b\w/g, (char) => char.toUpperCase());

export const getPartDisplayLabel = (partId, partLabels = {}) =>
  partLabels[partId] || PART_LABELS[partId] || humanizeKey(partId) || 'Part';

export const getVariantDisplayLabel = (variant) =>
  variant?.valName ||
  variant?.name ||
  variant?.label ||
  variant?.title ||
  (variant?.hex ? String(variant.hex).toUpperCase() : '') ||
  humanizeKey(variant?.key) ||
  'Selected';

const getPartSortIndex = (partId) => {
  const index = PART_DISPLAY_ORDER.indexOf(partId);
  return index >= 0 ? index : PART_DISPLAY_ORDER.length + 1;
};

export const getItemCustomizationGroups = (item, partLabels = {}) => {
  const colors = [];
  const options = [];
  const legacy = [];

  if (item?.parts && typeof item.parts === 'object') {
    Object.entries(item.parts)
      .sort(([partIdA], [partIdB]) => getPartSortIndex(partIdA) - getPartSortIndex(partIdB))
      .forEach(([partId, partState]) => {
        if (partState?.color) {
          colors.push({
            partId,
            partLabel: getPartDisplayLabel(partId, partLabels),
            value: getVariantDisplayLabel(partState.color),
            swatch: partState.color?.hex || ''
          });
        }

        if (partState?.option?.key && partState.option.key !== 'standard') {
          options.push({
            partId,
            partLabel: getPartDisplayLabel(partId, partLabels),
            value: getVariantDisplayLabel(partState.option)
          });
        }
      });
  }

  if ((!colors.length && !options.length) && item?.config && typeof item.config === 'object') {
    Object.entries(item.config)
      .filter(([, value]) => value)
      .forEach(([key, value]) => {
        legacy.push({
          key: humanizeKey(key),
          value: String(value)
        });
      });
  }

  return { colors, options, legacy };
};
