import * as path from 'node:path';

/**
 * Path utilities for normalizing file paths in AgentLens
 *
 * Rules:
 * - Files inside project directory: use relative paths
 * - Files outside project directory: use absolute paths
 */

/**
 * Check if a path is absolute
 */
export function isAbsolutePath(filePath: string): boolean {
  return path.isAbsolute(filePath);
}

/**
 * Normalize a file path for storage
 *
 * If the file is inside the project directory, returns a relative path.
 * If the file is outside the project directory, returns the absolute path.
 *
 * @param absolutePath - The absolute path to the file
 * @param projectRoot - The project root directory
 * @returns Normalized path (relative if inside project, absolute if outside)
 */
export function normalizeFilePath(absolutePath: string, projectRoot: string): string {
  // Ensure both paths use consistent separators and are normalized
  const normalizedAbsPath = path.normalize(absolutePath);
  // Remove trailing separator from project root for consistent comparison
  let normalizedRoot = path.normalize(projectRoot);
  if (normalizedRoot.endsWith(path.sep)) {
    normalizedRoot = normalizedRoot.slice(0, -1);
  }

  // Check if the file is inside the project directory
  if (normalizedAbsPath.startsWith(normalizedRoot + path.sep)) {
    // Return relative path (remove project root prefix)
    return path.relative(normalizedRoot, normalizedAbsPath);
  }

  // File is outside project directory, return absolute path
  return normalizedAbsPath;
}

/**
 * Resolve a stored file path to an absolute path
 *
 * If the path is already absolute, returns it as-is.
 * If the path is relative, resolves it against the project root.
 *
 * @param filePath - The stored file path (may be relative or absolute)
 * @param projectRoot - The project root directory
 * @returns Absolute path to the file
 */
export function resolveFilePath(filePath: string, projectRoot: string): string {
  if (isAbsolutePath(filePath)) {
    return filePath;
  }

  // Resolve relative path against project root
  return path.join(projectRoot, filePath);
}

/**
 * Check if a file path is inside the project directory
 *
 * @param filePath - The file path to check (relative or absolute)
 * @param projectRoot - The project root directory
 * @returns true if the file is inside the project directory
 */
export function isInsideProject(filePath: string, projectRoot: string): boolean {
  const absolutePath = resolveFilePath(filePath, projectRoot);
  const normalizedAbsPath = path.normalize(absolutePath);
  const normalizedRoot = path.normalize(projectRoot);

  return normalizedAbsPath.startsWith(normalizedRoot + path.sep);
}

/**
 * Get a display-friendly path
 *
 * For files inside the project, returns the relative path.
 * For files outside the project, returns the absolute path.
 *
 * @param filePath - The file path (may be relative or absolute)
 * @param projectRoot - The project root directory
 * @returns Display-friendly path
 */
export function getDisplayPath(filePath: string, projectRoot: string): string {
  if (isAbsolutePath(filePath)) {
    const normalizedPath = path.normalize(filePath);
    const normalizedRoot = path.normalize(projectRoot);

    if (normalizedPath.startsWith(normalizedRoot + path.sep)) {
      return path.relative(normalizedRoot, normalizedPath);
    }
    return normalizedPath;
  }

  // Already relative
  return filePath;
}
