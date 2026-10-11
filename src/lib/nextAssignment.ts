export type AssignmentSummary = {
 id:string; status:string; service_date:string; service_time?:string|null;
 show:{name:string; city:string; state?:string|null; event_type:string; starts_on:string; setup_at?:string|null; signing_at?:string|null; artist?:string|null; venue_name?:string|null; is_test?:boolean};
};
export function nextAssignment<T extends AssignmentSummary>(rows:readonly T[]):T|undefined {
 return rows.find(row=>!['approved','bonus_earned','bonus_not_earned'].includes(row.status));
}
export function assignmentDate(row:AssignmentSummary):Date {
 const signing=row.show.event_type==='signing';
 const timestamp=signing&&(row.show.setup_at||row.show.signing_at);
 if(timestamp)return new Date(timestamp);
 return new Date(`${signing?row.show.starts_on:row.service_date}T12:00:00`);
}
