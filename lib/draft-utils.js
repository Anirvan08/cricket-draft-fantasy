// Pure draft calculation helpers — safe to import in both client and server

export function getActivePickerOrder(pickNumber, numMembers) {
  const roundIndex = Math.floor((pickNumber - 1) / numMembers)
  const positionInRound = (pickNumber - 1) % numMembers

  if (roundIndex % 2 === 0) {
    return positionInRound + 1           // forward: 1, 2, 3 …
  } else {
    return numMembers - positionInRound  // reverse: N, N-1 …
  }
}

export function getRoundNumber(pickNumber, numMembers) {
  return Math.ceil(pickNumber / numMembers)
}
