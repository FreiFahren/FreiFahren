package feedback

import (
	"net/http"

	"github.com/FreiFahren/backend/database"
	"github.com/FreiFahren/backend/logger"
	"github.com/labstack/echo/v4"
)

type FeedbackRequest struct {
	Feedback string `json:"feedback"`
}

type FeedbackResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// @Summary Submit user feedback
//
// @Description Accepts a JSON payload containing user feedback and stores it in the database.
// @Description This endpoint validates that the feedback is not empty before saving it.
//
// @Tags feedback
//
// @Accept json
// @Produce json
//
// @Param feedbackData body FeedbackRequest true "User feedback data"
//
// @Success 200 {object} FeedbackResponse "Feedback submitted successfully"
// @Failure 400 {object} FeedbackResponse "Invalid request or empty feedback"
// @Failure 500 {object} FeedbackResponse "Failed to save feedback"
//
// @Router /feedback [post]
func PostFeedback(c echo.Context) error {
	logger.Log.Info().Msg("POST /feedback")

	var req FeedbackRequest
	if err := c.Bind(&req); err != nil {
		logger.Log.Error().Err(err).Msg("Failed to bind feedback request")
		return c.JSON(http.StatusBadRequest, FeedbackResponse{
			Success: false,
			Message: "Invalid request",
		})
	}

	if req.Feedback == "" {
		return c.JSON(http.StatusBadRequest, FeedbackResponse{
			Success: false,
			Message: "Feedback cannot be empty",
		})
	}

	err := database.InsertFeedback(req.Feedback)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to insert feedback")
		return c.JSON(http.StatusInternalServerError, FeedbackResponse{
			Success: false,
			Message: "Failed to save feedback",
		})
	}

	return c.JSON(http.StatusOK, FeedbackResponse{
		Success: true,
		Message: "Feedback submitted",
	})
}
