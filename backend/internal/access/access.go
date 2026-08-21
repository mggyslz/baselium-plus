// Package access centralizes relationship checks for protected elder data.
package access

import "database/sql"

// CaregiverHasElder reports whether an active caregiver assignment exists.
func CaregiverHasElder(db *sql.DB, caregiverID, userID int) (bool, error) {
	var allowed bool
	err := db.QueryRow(`SELECT EXISTS(
		SELECT 1 FROM user_caregiver
		WHERE caregiver_id = $1 AND user_id = $2 AND is_active = TRUE
	)`, caregiverID, userID).Scan(&allowed)
	return allowed, err
}

// FamilyHasElder reports whether an active family-access grant exists.
func FamilyHasElder(db *sql.DB, familyID, userID int) (bool, error) {
	var allowed bool
	err := db.QueryRow(`SELECT EXISTS(
		SELECT 1 FROM family_access
		WHERE family_id = $1 AND user_id = $2 AND is_active = TRUE
	)`, familyID, userID).Scan(&allowed)
	return allowed, err
}

// CaregiverHasAnomaly ensures an anomaly belongs to an elder assigned to the caregiver.
func CaregiverHasAnomaly(db *sql.DB, caregiverID, anomalyID int) (bool, error) {
	var allowed bool
	err := db.QueryRow(`SELECT EXISTS(
		SELECT 1 FROM anomalies a
		JOIN user_caregiver uc ON uc.user_id = a.user_id
		WHERE a.anomaly_id = $1 AND uc.caregiver_id = $2 AND uc.is_active = TRUE
	)`, anomalyID, caregiverID).Scan(&allowed)
	return allowed, err
}
