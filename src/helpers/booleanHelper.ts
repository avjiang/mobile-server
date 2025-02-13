export let parseBoolean = (value: string | undefined) => {
  const truthyValues = ['true', '1', 'yes', 'y'];
  const falsyValues = ['false', '0', 'no', 'n'];

  if (value) {
    const lowerValue = value.toLowerCase();
    if (truthyValues.includes(lowerValue)) return true;
    if (falsyValues.includes(lowerValue)) return false;
  }
  return false; // Default to false if the value is not recognized
}