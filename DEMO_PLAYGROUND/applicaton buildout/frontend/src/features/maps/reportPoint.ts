export type ReportPoint = [number, number];
export function validReportPoint(point: ReportPoint) {
  return point.every(Number.isFinite) && point[0] >= -84.80 && point[0] <= -84.74 && point[1] >= 43.56 && point[1] <= 43.62;
}
