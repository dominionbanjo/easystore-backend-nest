import { User } from 'src/users/entities/user.entity';

export function sanitizeUser(user: User) {
  return {
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    phone_number: user.phone_number,
    account_type: user.account_type,
    username: user.username,
    email_verified: user.email_verified,
    avatar: user.avatar,
    rating_average: user.rating_average,
    rating_count: user.rating_count,
    review_count: user.review_count,
    address: user.address,
    payout_verified: user.payout_verified,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

export function sanitizeReviewUser(user: User) {
  return {
    id: user.id,
    full_name: `${user.first_name} ${user.last_name}`,
    avatar: user.avatar,
  };
}
