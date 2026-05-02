type MeetingType = {
	_id: string;
	name: string;
	slug: string;
	duration: number;
	isDefault: boolean;
};

type BookingQuota = {
	used: number;
	limit: number;
	remaining: number;
	plan: string;
};

export async function saveAvailability<T>(blocks: T[]): Promise<T[]> {
	await new Promise((resolve) => setTimeout(resolve, 200));
	return blocks;
}

export async function getMeetingTypes(): Promise<MeetingType[]> {
	return [];
}

export async function createMeetingType(input: {
	name: string;
	duration: number;
	isDefault?: boolean;
}): Promise<MeetingType> {
	const slug = input.name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");

	return {
		_id: `local-${Math.random().toString(36).slice(2, 10)}`,
		name: input.name,
		slug,
		duration: input.duration,
		isDefault: !!input.isDefault,
	};
}

export async function getBookingLinkWithMeetingType(
	meetingTypeSlug: string,
): Promise<{ url: string }> {
	const base =
		typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
	return { url: `${base}/book/${meetingTypeSlug}` };
}

export async function getBookingQuota(): Promise<BookingQuota> {
	return {
		used: 0,
		limit: 100,
		remaining: 100,
		plan: "free",
	};
}

export async function hasConnectedAccount(): Promise<boolean> {
	return true;
}
