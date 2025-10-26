/**
 * Calculate checksum for VE.Direct protocol
 * @param {Buffer} blockBuffer - The buffer to calculate checksum for
 * @returns {number} The checksum value (0-255)
 */
function checksum (blockBuffer) {
  return blockBuffer.reduce((prev, curr) => {
    return (prev + curr) & 255
  }, 0)
}

module.exports = { checksum }
