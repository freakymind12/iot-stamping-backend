const productionModel = require("../models/productionModel");
const dateHandle = require("../middleware/dateHandle");

// fungsi untuk handle response permintaan
const handleResponse = (res, message, status = 200, data = null) => {
  if (data !== null) {
    res.status(status).json({ message, data });
  } else {
    res.status(status).json({ message });
  }
};
// fungsi untuk handle error permintaan
const handleError = (res, error) => {
  console.error("Error:", error);
  res.status(500).json({ message: "Server Error" });
};

// ==================== FUNCTION FOR DATA PROCESS ==================
// fungsi untuk format struktur data production daily weekly
const processProduction = (dateRange, queryResult) => {
  const initializeShiftData = () => ({
    ok: Array(dateRange.length).fill(0),
    ng: Array(dateRange.length).fill(0),
    reject_setting: Array(dateRange.length).fill(0),
    dummy: Array(dateRange.length).fill(0),
    production_time: Array(dateRange.length).fill(0),
    stop_time: Array(dateRange.length).fill(0),
    dandori_time: Array(dateRange.length).fill(0),
    kadoritsu: Array(dateRange.length).fill(0),
    bekidoritsu: Array(dateRange.length).fill(0),
  });

  const updateShiftData = (shiftData, result, index) => {
    shiftData.ok[index] += result.ok;
    shiftData.ng[index] += result.ng;
    shiftData.reject_setting[index] += result.reject_setting;
    shiftData.dummy[index] += result.dummy;
    shiftData.production_time[index] += result.production_time;
    shiftData.stop_time[index] += result.stop_time;
    shiftData.dandori_time[index] += result.dandori_time;
    shiftData.kadoritsu[index] += Number(result.kadoritsu);
    shiftData.bekidoritsu[index] += Number(result.bekidoritsu);
  };

  const data = {
    date_range: dateRange,
    shift1: initializeShiftData(),
    shift2: initializeShiftData(),
  };

  queryResult.forEach((result) => {
    const date = result.date.slice(0, 10);
    const shift = result.shift;
    const index = dateRange.indexOf(date);
    if (index !== -1) {
      updateShiftData(data[`shift${shift}`], result, index);
    }
  });

  return data;
};

const processDailyOee = (dateRange, queryResult) => {
  const initializeDailyData = () => ({
    oee: Array(dateRange.length).fill(0),
    availability: Array(dateRange.length).fill(0),
    productivity: Array(dateRange.length).fill(0),
    quality: Array(dateRange.length).fill(0),
  })

  const updateDailyData = (dailyData, result, index) => {
    dailyData.oee[index] += Number(result.oee);
    dailyData.availability[index] += Number(result.availability);
    dailyData.productivity[index] += Number(result.productivity);
    dailyData.quality[index] += Number(result.quality);
  };

  const data = {
    date_range: dateRange,
    daily_oee: initializeDailyData(),
  }

  queryResult.forEach((result) => {
    const date = result.date;
    const index = dateRange.indexOf(date);
    if (index !== -1) {
      updateDailyData(data.daily_oee, result, index);
    }
  });

  return data;
}

// fungsi untuk format struktur data production yearly
const generateFiscalYearMonths = (year) => {
  const fiscalYearMonths = [];
  for (let month = 4; month <= 12; month++) {
    fiscalYearMonths.push(`${year}-${month}`);
  }
  for (let month = 1; month <= 3; month++) {
    fiscalYearMonths.push(parseInt(year) + 1 + "-" + month);
  }
  return fiscalYearMonths;
};

const groupData = (year, data) => {
  const result = {
    year_month: generateFiscalYearMonths(year),
    ok: [],
    ng: [],
    reject_setting: [],
    dummy: [],
    production_time: [],
    dandori_time: [],
    stop_time: [],
    kadoritsu: [],
  };

  const defaultData = {
    ok: 0,
    ng: 0,
    reject_setting: 0,
    dummy: 0,
    production_time: 0,
    dandori_time: 0,
    stop_time: 0,
    kadoritsu: 0,
  };

  result.year_month.forEach((ym) => {
    const [year, month] = ym.split("-").map(Number);
    const item =
      data.find((d) => d.year === year && d.month === month) || defaultData;

    result.ok.push(Number(item.ok));
    result.ng.push(Number(item.ng));
    result.reject_setting.push(Number(item.reject_setting));
    result.dummy.push(Number(item.dummy));
    result.production_time.push(Number(item.production_time));
    result.dandori_time.push(Number(item.dandori_time));
    result.stop_time.push(Number(item.stop_time));
    result.kadoritsu.push(Number(item.kadoritsu));
  });
  return result;
};

// =================================================================

// FUNCTION CALCULATE SALES AND REJECT COST
function sumSalesAndRejectCost(year, data) {
  const result = {
    year_month: generateFiscalYearMonths(year),
    sales: [],
    reject_cost: [],
  };

  const defaultData = {
    sales: 0,
    reject_cost: 0,
  };

  const tempData = {};
  data.forEach((item) => {
    const key = `${item.year}-${item.month}`;

    if (!tempData[key]) {
      tempData[key] = {
        year_month: key,
        sales: item.sales,
        reject_cost: item.reject_cost,
      };
    } else {
      tempData[key].sales += item.sales;
      tempData[key].reject_cost += item.reject_cost;
    }
  });

  result.year_month.forEach((ym) => {
    const [yearStr, monthStr] = ym.split("-");
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    const item = tempData[`${year}-${month}`] || defaultData;
    result.sales.push(item.sales);
    result.reject_cost.push(item.reject_cost);
  });

  return result;
}
//

const getAllProduction = (req, res) => {
  productionModel
    .getAllProduction()
    .then((production) => {
      const data =
        production.length === 0 ? "No production data available" : production;
      handleResponse(res, "Success", 200, data);
    })
    .catch((error) => {
      handleError(res, error);
    });
};

const getAllProductionFilterMachineMonth = async (req, res) => {
  const { id_machine, year, month } = req.query;
  try {
    const data = await productionModel.getAllProductionFilterMachineMonth(
      id_machine,
      year,
      month
    );
    const message =
      data.length === 0 ? "No production data available" : "Success";
    return handleResponse(res, message, 200, data);
  } catch (error) {
    handleError(res, error);
  }
};

const getTrendProductionByDate = async (req, res) => {
  const { id_machine, date_start, date_end } = req.query;
  try {
    const data = await productionModel.filterProductionByDate(
      id_machine,
      date_start,
      date_end
    );
    const message = data.length === 0 ? "No data production" : "Success";
    // Generate Array Date Range sesuai inputan request dari front end untuk ploting ke front end
    const dateRange = dateHandle.generateDateRange(date_start, date_end);
    const formattedData = processProduction(dateRange, data);

    return handleResponse(res, message, 200, formattedData);
  } catch (error) {
    handleError(res, error);
  }
};

const getProductionByDate = async (req, res) => {
  const { id_machine, date_start, date_end } = req.query;
  try {
    const data = await productionModel.filterProductionByDate(
      id_machine,
      date_start,
      date_end
    );
    const message = data.length === 0 ? "No data production" : "Success";

    return handleResponse(res, message, 200, data);
  } catch (error) {
    handleError(res, error);
  }
};

const getPpmByDate = async (req, res) => {
  const { id_machine, date_start, date_end } = req.query;
  let message = "Success";
  try {
    const data = await productionModel.ppmProductionByDate(
      id_machine,
      date_start,
      date_end
    );
    for (let prop in data[0]) {
      if (data[0][prop] === null) {
        data[0][prop] = "0";
      }
    }
    return handleResponse(res, message, 200, data);
  } catch (error) {
    handleError(res, error);
  }
};

const getProductionByIdProduct = async (req, res) => {
  const { id_product } = req.query;
  try {
    if (!id_product) {
      return handleResponse(res, "Query params required",400);
    }
    const data = await productionModel.filterProductionByIdProduct(id_product);
    const message = data.length === 0 ? "No data production" : "Success";
    return handleResponse(res, message, 200, data);
  } catch (error) {
    handleError(res, error);
  }
};

const getProductionByIdMachineYesterday = async (req, res) => {
  const { id_machine, shift } = req.query;
  try {
    if (!id_machine || !shift) {
      return handleResponse(res, "Query parameter required");
    }

    const data = await productionModel.filterProductionByIdMachineYesterday(
      id_machine,
      shift
    );
    const template = {
      ok: 0,
      ng: 0,
      reject_setting: 0,
      stop_time: 0,
      id_product: null,
      dummy: 0,
      product_name: null,
      dandori_time: 0,
    };

    const productionData =
      data.length === 0 ? template : { ...template, ...data[0] };
    const message = data.length === 0 ? "No data production" : "Success";

    return handleResponse(res, message, 200, productionData);
  } catch (error) {
    handleError(res, error);
  }
};

const getProductionByMachineMonth = async (req, res) => {
  const { id_machine, year, month } = req.query;
  try {
    const data = await productionModel.productionByMachineMonth(
      id_machine,
      year,
      month
    );
    const message = data.length === 0 ? "No data production" : "Success";
    return handleResponse(res, message, 200, data);
  } catch (error) {
    handleError(res, error);
  }
};

const getTotalProductionAllMachineByMonth = async (req, res) => {
  const { id_machine, year, month } = req.query;
  try {
    const data = await productionModel.totalProductionByMonth(
      id_machine,
      year,
      month
    );
    const message = data.length === 0 ? "No data production" : "Success";
    return handleResponse(res, message, 200, data);
  } catch (error) {
    handleError(res, error);
  }
};

const getFiscalProductionByYearMonth = async (req, res) => {
  const { year, id_machine } = req.query;
  try {
    const data = await productionModel.filterProductionFiscalByYearMonth(
      year,
      id_machine
    );
    const message = data.length === 0 ? "No data production" : "Success";
    const formattedData = groupData(year, data);
    return handleResponse(res, message, 200, formattedData);
  } catch (error) {
    handleError(res, error);
  }
};

const getSummarySalesAndRejectCost = async (req, res) => {
  const { year } = req.query;
  try {
    const data = await productionModel.summarySalesAndRejectCost(year);
    const message = data.length === 0 ? "No Data" : "Success";
    const formattedData = sumSalesAndRejectCost(year, data);
    return handleResponse(res, message, 200, formattedData);
  } catch (error) {
    handleError(res, error);
  }
};

const updateProduction = async (req, res) => {
  try {
    const { reject_setting, ng } = req.body;
    if (reject_setting === "" || ng === "") {
      return handleResponse(res, "All fields are required", 400);
    }
    await productionModel.updateProductionById(req.params.id, req.body);
    return handleResponse(res, "Update production data successfully");
  } catch (error) {
    handleError(res, error);
  }
};

const getSummaryMonthlyOee = async (req, res) => {
  const { id_machine, year, month } = req.query;
  try {
    if (!id_machine || !year || !month) {
      return handleResponse(res, "Query params required", 400);
    }
    
    const data = await productionModel.summaryMonthlyOee(id_machine, year, month);
    
    const convertedData = data.map(item => {
      return {
        availability: Number(item.availability),
        productivity: Number(item.productivity),
        quality: Number(item.quality),
        oee: Number(item.oee)
      };
    });
    
    const message = convertedData.length === 0 ? "No data" : "Success";
    
    return handleResponse(res, message, 200, convertedData);
  } catch (error) {
    handleError(res, error);
  }
};


const getDailyOee = async (req, res) => {
  const { id_machine, year, month } = req.query
  try {
    if(!id_machine || !year || !month ){
      return handleResponse(res, "Query params required", 400);
    }
    const data = await productionModel.dailyOee(id_machine, year, month)
    const date_range = dateHandle.generateDates(year, month)
    const formattedData = processDailyOee(date_range, data)
    const message = data.length === 0 ? "No Data" : "Success"

    return handleResponse(res, message, 200, formattedData)
    // const date_range = dateHandle.generateDates(year,month)
  } catch (error) {
    handleError(res, error)
  }
}

module.exports = {
  getAllProduction,
  getAllProductionFilterMachineMonth,
  getProductionByDate,
  getProductionByIdProduct,
  getProductionByIdMachineYesterday,
  updateProduction,
  getPpmByDate,
  getTrendProductionByDate,
  getProductionByMachineMonth,
  getTotalProductionAllMachineByMonth,
  getFiscalProductionByYearMonth,
  getSummarySalesAndRejectCost,
  getSummaryMonthlyOee,
  getDailyOee
};
