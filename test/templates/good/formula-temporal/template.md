Hello {{message}}! The instant is **{{% return temporalNow.toString() %}}**, the same as {{% return now.toISOString() %}}.

In New York it is still {{% return temporalNow.toZonedDateTimeISO('America/New_York').toPlainDate().toString() %}}.

The agreement became effective {{% return Temporal.Instant.from(effectiveDate).until(temporalNow, { largestUnit: 'hours' }).hours %}} hours ago.
