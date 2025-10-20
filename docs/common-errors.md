### Common errors

Given the inconsistency of financial reports and the overwhelming amount of
formats used, the AI can be led to errors. Some of the most common errors are:

- ❌ **Attach a website when the actual target is a downloadable file**. No
  browser interactions are performed. In that case, download or navigate
  directly to the file you want and either attach it or paste its direct URL.

- ❌ **Confuse negative variations for any of the price-dependent metrics**.
  These imply an improvement in valuation. For example, a lower P/E or P/BV
  indicates a more attractive valuation given a constant price across periods.

- ❌ **Calculate price-dependent metrics with non-annual data**. If you
  speculate with quarterly or semi-annual data and did not submit previous
  fields to calculate the TTM data, It defaults to current data, so the values
  won’t reflect the company’s annual position. For example, net profit will be
  for that quarter or semester, not the full year, so the score will be worse
  and the required price and profit higher. A rough approximation is to
  multiply/divide by 4 for quarterly and by 2 for semi-annual, but this won’t
  reflect seasonality and other factors. Prefer annual data or fill TTM reports.

- ❌ **Edge cases**. Pay special attention if the company reports its results
  for the last period (quarterly or annual) in January of the following year.
  Certain companies name their reports in the year they present them. For
  example, MongoDB on 31/01/2024 presents its report containing information from
  01/02/2023 to 31/01/2024, practically all of 2023. In other cases, for example
  Inditex, it can be observed that in its 2022 report, it uses 31/01/2023 for
  the balance sheet and 2022 for the income statement. To address these complex
  scenarios and guarantee consistency with the reflected data, the pipeline
  processes reports so that for MongoDB it would return the 2023 annual report
  and for Inditex the 2022 annual report, since those are the years covered. So
  if you were to analyze these companies, you would use '2023-Y' as the period
  for MongoDB and '2022-Y' for Inditex.

- ❌ **Submitting unsupported companies sectors**. Such as insurance companies
  or banks. In these cases, some of the data that the pipeline tries to obtain
  is not reported, which will lead to errors and inconsistencies.

- ❌ **Requesting quarterly information when the report shows data for the
  previous 9 months** For example, Apple occasionally reports _"9 months
  ended"_. Keep in mind that certain financial statements report the cumulative
  total across quarters. Exercise extreme care in these scenarios and maintain
  consistency in the files sent. In other cases (e.g., Spotify), they report
  their most recent quarterly report and in the balance sheet compare the data
  with the previous year-end close, so the balance sheet may show 2024-Q1
  compared to 2023-Q4.

- ❌ **Sending files that do not contain text**, but where each page is an
  image. For example sending a PDF consisting of images. In these cases the
  information cannot be extracted, since Intrinsic relies on LLMs that will not
  process images.

- ❌ **Sending financial reports that contain multiple periods**. For example a
  report that shows an income statement with quarterly, semi-annual, and annual
  data covering 3 years, and where consolidated and non-consolidated versions
  appear. Such a report could contain 18 potential values for each metric,
  increasing the chance of mixing up data. It is recommended to send files that
  do not cover multiple periods. The more precise the period, the better.
  Remember that you can also select a page range.

- ❌ **Entering a wrong period that does not correspond to the report**.

- ❌ **Confusing the calendar year with the fiscal year**. For example, a
  company may report its 2024 financial statement in March 2024, containing most
  of the data from 2023. Try to always use the same reports for that company,
  ideally their annual reports.

💡 **Recommendations:**

- Try to always send the same type of report for each company and preferably
  consolidated reports. The more standardized and professional the report, the
  easier it will be to correctly extract the information.

- Prefer annual reports, since dates and periods are usually more specific and
  there’s less chance of using incorrect values.

- Remember you can manually modify values in the data display UI by clicking the
  **edit** icon.
