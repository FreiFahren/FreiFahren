import { DbConnection, InsertFeedback, feedback } from '../../db'

export class FeedbackService {
    constructor(private db: DbConnection) {}

    async createFeedback(feedbackData: InsertFeedback) {
        await this.db.insert(feedback).values(feedbackData)
    }
}
